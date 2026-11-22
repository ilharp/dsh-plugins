use std::sync::Arc;

use axum::debug_handler;
use axum::extract::Path;
use axum::extract::State;
use sea_orm::DatabaseConnection;
use sea_orm::FromQueryResult;
use sea_orm::entity::prelude::DateTime;
use sea_orm::raw_sql;
use serde::Serialize;
use serde_json::Value;

use crate::AppState;
use crate::server::ApiJson;
use crate::server::AppError;
use crate::server::ErrorResponseBody;
use crate::server::ResponseBody;

/// Repository projection. Shared with `repository_get`, which returns the
/// same shape; `id` is only used to locate the row and never serialized.
#[derive(Debug, FromQueryResult, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryData {
    #[serde(skip)]
    pub id: i32,
    owner: String,
    repo: String,
    license: Option<String>,
    stars: Option<i32>,
    forks: Option<i32>,
    open_issues: Option<i32>,
}

#[derive(FromQueryResult)]
struct PluginRow {
    id: i32,
    name: String,
    npm_name: Option<String>,
    github_path: Option<String>,
    repository_id: Option<i32>,
}

// Also the response item: `rename_all` turns the fields into
// `packageVersion` / `dshVersion`, matching the legacy yml shape.
#[derive(Debug, FromQueryResult, Serialize)]
#[serde(rename_all = "camelCase")]
struct VersionRow {
    package_version: String,
    dsh_version: String,
}

#[derive(FromQueryResult)]
struct EvaluationRow {
    version: i32,
    sha: String,
    evaluated_at: DateTime,
    evaluator: String,
    result: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailData {
    id: i32,
    name: String,
    npm_name: Option<String>,
    github_path: Option<String>,
    repository: Option<RepositoryData>,
    versions: Vec<VersionRow>,
    evaluations: Vec<EvaluationData>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct EvaluationData {
    version: i32,
    sha: String,
    // Column stores a naive UTC timestamp; the API exposes epoch
    // milliseconds because a Z-less ISO string would be parsed as local
    // time by JS.
    #[serde(rename = "evaluatedAt")]
    evaluated_at: i64,
    evaluator: String,
    // Column is `result`; the legacy contract called it `results`.
    #[serde(rename = "results")]
    result: Value,
}

fn not_found() -> Response {
    Response::Error(ErrorResponseBody {
        code: 404,
        msg: "not found".to_owned(),
    })
}

/// Fetch one plugin with its repository, all versions and all evaluations.
/// Shared with `package_get`, which resolves an npm name to an id first.
/// Returns `None` when the plugin does not exist.
pub async fn assemble_detail(
    db: &DatabaseConnection,
    plugin_id: i32,
) -> anyhow::Result<Option<DetailData>> {
    let plugin: Option<PluginRow> = PluginRow::find_by_statement(raw_sql!(
        Postgres,
        r#"SELECT
"plugin_v1"."id",
"plugin_v1"."name",
NULLIF("plugin_v1"."npm_name", '') AS "npm_name",
NULLIF("plugin_v1"."github_path", '') AS "github_path",
"plugin_v1"."repository_id"
FROM "plugin_v1"
WHERE "plugin_v1"."id" = {plugin_id}
"#
    ))
    .one(db)
    .await?;

    let plugin = match plugin {
        Some(plugin) => plugin,
        None => return Ok(None),
    };

    let repository: Option<RepositoryData> = match plugin.repository_id {
        None => None,
        Some(repository_id) => {
            RepositoryData::find_by_statement(raw_sql!(
                Postgres,
                r#"SELECT
"repository_v1"."id",
"repository_v1"."owner",
"repository_v1"."repo",
NULLIF("repository_v1"."license", '') AS "license",
"repository_v1"."stars",
"repository_v1"."forks",
"repository_v1"."open_issues"
FROM "repository_v1"
WHERE "repository_v1"."id" = {repository_id}
"#
            ))
            .one(db)
            .await?
        }
    };

    let versions: Vec<VersionRow> = VersionRow::find_by_statement(raw_sql!(
        Postgres,
        r#"SELECT
"plugin_version_v1"."package_version",
"plugin_version_v1"."dsh_version"
FROM "plugin_version_v1"
WHERE "plugin_version_v1"."plugin_id" = {plugin_id}
ORDER BY "plugin_version_v1"."seq"
"#
    ))
    .all(db)
    .await?;

    let evaluations: Vec<EvaluationData> = EvaluationRow::find_by_statement(raw_sql!(
        Postgres,
        r#"SELECT
"evaluation_v1"."version",
"evaluation_v1"."sha",
"evaluation_v1"."evaluated_at",
"evaluation_v1"."evaluator",
"evaluation_v1"."result"
FROM "evaluation_v1"
WHERE "evaluation_v1"."plugin_id" = {plugin_id}
ORDER BY "evaluation_v1"."evaluated_at"
"#
    ))
    .all(db)
    .await?
    .into_iter()
    .map(|row| EvaluationData {
        version: row.version,
        sha: row.sha,
        evaluated_at: row.evaluated_at.and_utc().timestamp_millis(),
        evaluator: row.evaluator,
        result: row.result,
    })
    .collect();

    Ok(Some(DetailData {
        id: plugin.id,
        name: plugin.name,
        npm_name: plugin.npm_name,
        github_path: plugin.github_path,
        repository,
        versions,
        evaluations,
    }))
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum Response {
    Data(ResponseBody<DetailData>),
    Error(ErrorResponseBody),
}

#[debug_handler]
pub async fn controller_plugin_get(
    State(app_state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> anyhow::Result<ApiJson<Response>, AppError> {
    let id: i32 = match id.parse::<i32>() {
        Ok(id) if id >= 1 => id,
        _ => {
            return Ok(ApiJson(Response::Error(ErrorResponseBody {
                code: 400,
                msg: "invalid parameter: id".to_owned(),
            })));
        }
    };

    match assemble_detail(&app_state.db, id).await? {
        Some(data) => Ok(ApiJson(Response::Data(ResponseBody::new(data)))),
        None => Ok(ApiJson(not_found())),
    }
}
