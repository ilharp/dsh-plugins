use std::sync::Arc;

use axum::debug_handler;
use axum::extract::Path;
use axum::extract::State;
use sea_orm::FromQueryResult;
use sea_orm::raw_sql;
use serde::Serialize;

use crate::AppState;
use crate::server::controller::plugin_get::assemble_detail;
use crate::server::ApiJson;
use crate::server::AppError;
use crate::server::ErrorResponseBody;
use crate::server::ResponseBody;

#[derive(FromQueryResult)]
struct PluginIdRow {
    id: i32,
}

#[derive(Serialize)]
#[serde(untagged)]
pub enum Response {
    Data(ResponseBody<crate::server::controller::plugin_get::DetailData>),
    Error(ErrorResponseBody),
}

#[debug_handler]
pub async fn controller_package_get(
    State(app_state): State<Arc<AppState>>,
    Path(name): Path<String>,
) -> anyhow::Result<ApiJson<Response>, AppError> {
    // npm names are stored lowercase; lower the input so legacy uppercase
    // links keep resolving while the column index stays usable.
    let found: Option<PluginIdRow> = PluginIdRow::find_by_statement(raw_sql!(
        Postgres,
        r#"SELECT "plugin_v1"."id"
FROM "plugin_v1"
WHERE "plugin_v1"."npm_name" = LOWER({name})
ORDER BY "plugin_v1"."id"
LIMIT 1
"#
    ))
    .one(&app_state.db)
    .await?;

    let plugin_id = match found {
        Some(row) => row.id,
        None => {
            return Ok(ApiJson(Response::Error(ErrorResponseBody {
                code: 404,
                msg: "not found".to_owned(),
            })))
        }
    };

    match assemble_detail(&app_state.db, plugin_id).await? {
        Some(data) => Ok(ApiJson(Response::Data(ResponseBody::new(data)))),
        None => {
            Ok(ApiJson(Response::Error(ErrorResponseBody {
                code: 404,
                msg: "not found".to_owned(),
            })))
        }
    }
}
