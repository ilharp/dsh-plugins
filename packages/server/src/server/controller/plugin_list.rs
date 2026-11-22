use std::sync::Arc;

use anyhow::Context;
use axum::debug_handler;
use axum::extract::Query;
use axum::extract::State;
use sea_orm::FromQueryResult;
use sea_orm::raw_sql;
use serde::Deserialize;
use serde::Serialize;

use crate::AppState;
use crate::server::ApiJson;
use crate::server::AppError;
use crate::server::ErrorResponseBody;
use crate::server::ResponseBody;

pub const PAGE_SIZE: i64 = 36;

#[derive(Deserialize)]
pub struct Request {
    page: Option<String>,
}

#[derive(FromQueryResult)]
struct CountRow {
    count: i64,
}

/// One row of the plugin listing. Shared with `repository_get`, which lists
/// the plugins of one repository with the same projection.
#[derive(Debug, FromQueryResult, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginListItem {
    id: i32,
    name: String,
    // Empty string means "no npm package" in the database; NULLIF lifts it
    // to null so the web layer only ever sees null.
    npm_name: Option<String>,
    github_path: Option<String>,
    owner: Option<String>,
    repo: Option<String>,
    latest_package_version: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListData {
    total: i64,
    page: i64,
    page_size: i64,
    items: Vec<PluginListItem>,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum Response {
    Data(ResponseBody<ListData>),
    Error(ErrorResponseBody),
}

fn invalid_page() -> Response {
    Response::Error(ErrorResponseBody {
        code: 400,
        msg: "invalid parameter: page".to_owned(),
    })
}

#[debug_handler]
pub async fn controller_plugin_list(
    State(app_state): State<Arc<AppState>>,
    Query(request): Query<Request>,
) -> anyhow::Result<ApiJson<Response>, AppError> {
    // Count first: page validity is checked against the last page.
    let count: CountRow = CountRow::find_by_statement(raw_sql!(
        Postgres,
        r#"SELECT COUNT(*) AS "count" FROM "plugin_v1""#
    ))
    .one(&app_state.db)
    .await?
    .context("Plugin count query returned no row")?;

    let total = count.count;
    let max_page = (total + PAGE_SIZE - 1) / PAGE_SIZE;

    let page: i64 = match request.page {
        None => 1,
        Some(ref raw) => match raw.parse::<i64>() {
            Ok(value) if value >= 1 => value,
            _ => return Ok(ApiJson(invalid_page())),
        },
    };
    if page > max_page {
        return Ok(ApiJson(invalid_page()));
    }

    let limit = PAGE_SIZE;
    let offset = (page - 1) * PAGE_SIZE;

    // Newest plugin first; a later cron may switch to score-based ordering.
    let items: Vec<PluginListItem> = PluginListItem::find_by_statement(raw_sql!(
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
ORDER BY "plugin_v1"."id" DESC
LIMIT {limit} OFFSET {offset}
"#
    ))
    .all(&app_state.db)
    .await?;

    Ok(ApiJson(Response::Data(ResponseBody::new(ListData {
        total,
        page,
        page_size: PAGE_SIZE,
        items,
    }))))
}
