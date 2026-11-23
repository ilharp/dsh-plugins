use std::sync::Arc;

use axum::debug_handler;
use axum::extract::Path;
use axum::extract::State;
use sea_orm::FromQueryResult;
use sea_orm::raw_sql;
use serde::Serialize;

use crate::AppState;
use crate::server::controller::plugin_get::RepositoryData;
use crate::server::controller::plugin_list::PluginListItem;
use crate::server::ApiJson;
use crate::server::AppError;
use crate::server::ErrorResponseBody;
use crate::server::ResponseBody;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoData {
    repository: RepositoryData,
    plugins: Vec<PluginListItem>,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum Response {
    Data(ResponseBody<RepoData>),
    Error(ErrorResponseBody),
}

#[debug_handler]
pub async fn controller_repository_get(
    State(app_state): State<Arc<AppState>>,
    Path((owner, repo)): Path<(String, String)>,
) -> anyhow::Result<ApiJson<Response>, AppError> {
    // The unique index is on (lower(owner), lower(repo)); lowering the
    // parameters keeps that index usable.
    let repository: Option<RepositoryData> = RepositoryData::find_by_statement(raw_sql!(
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
WHERE lower("repository_v1"."owner") = lower({owner})
AND lower("repository_v1"."repo") = lower({repo})
"#
    ))
    .one(&app_state.db)
    .await?;

    let repository = match repository {
        Some(repository) => repository,
        None => {
            return Ok(ApiJson(Response::Error(ErrorResponseBody {
                code: 404,
                msg: "not found".to_owned(),
            })))
        }
    };

    let repository_id = repository.id;

    let plugins: Vec<PluginListItem> = PluginListItem::find_by_statement(raw_sql!(
        Postgres,
        r#"SELECT
"plugin_v1"."id",
"plugin_v1"."name",
NULLIF("plugin_v1"."npm_name", '') AS "npm_name",
NULLIF("plugin_v1"."github_path", '') AS "github_path",
"repository_v1"."owner",
"repository_v1"."repo",
(
SELECT "pv"."package_version"
FROM "plugin_version_v1" "pv"
WHERE "pv"."plugin_id" = "plugin_v1"."id"
ORDER BY "pv"."seq" DESC
LIMIT 1
) AS "latest_package_version"
FROM "plugin_v1"
LEFT JOIN "repository_v1" ON "repository_v1"."id" = "plugin_v1"."repository_id"
WHERE "plugin_v1"."repository_id" = {repository_id}
ORDER BY "plugin_v1"."id"
"#
    ))
    .all(&app_state.db)
    .await?;

    Ok(ApiJson(Response::Data(ResponseBody::new(RepoData {
        repository,
        plugins,
    }))))
}
