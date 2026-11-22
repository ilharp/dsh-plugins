use std::fmt::Debug;

use anyhow::Error;
use axum::Json;
use axum::extract::FromRequest;
use axum::extract::rejection::JsonRejection;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::response::Response;
use serde::Serialize;
use tracing::error;

pub mod controller;

#[derive(FromRequest)]
#[from_request(via(Json), rejection(ApiError))]
pub struct ApiJson<T>(T);

impl<T> IntoResponse for ApiJson<T>
where
    Json<T>: IntoResponse,
{
    fn into_response(self) -> Response {
        Json(self.0).into_response()
    }
}

#[derive(Debug, Serialize)]
pub struct ResponseBody<D>
where
    D: Debug + Serialize,
{
    code: u16,
    data: D,
}

impl<D> ResponseBody<D>
where
    D: Debug + Serialize,
{
    fn new(data: D) -> ResponseBody<D> {
        ResponseBody { code: 200, data }
    }
}

#[derive(Debug, Serialize)]
pub struct ErrorResponseBody {
    code: u16,
    msg: String,
}

pub enum ApiError {
    InvalidJsonError(String),
    AuthorizationError,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (code, msg) = match self {
            ApiError::InvalidJsonError(body) => (StatusCode::BAD_REQUEST.as_u16(), body),
            ApiError::AuthorizationError => (StatusCode::FORBIDDEN.as_u16(), "".to_owned()),
        };

        (StatusCode::OK, ApiJson(ErrorResponseBody { code, msg })).into_response()
    }
}

impl From<JsonRejection> for ApiError {
    fn from(value: JsonRejection) -> Self {
        ApiError::InvalidJsonError(value.body_text())
    }
}

pub struct AppError(Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        // Log the full chain internally; never echo internals to the public
        // gateway in front of this service.
        error!("{:?}", self.0);

        (
            StatusCode::OK,
            Json(ErrorResponseBody {
                code: StatusCode::INTERNAL_SERVER_ERROR.as_u16(),
                msg: "internal error".to_owned(),
            }),
        )
            .into_response()
    }
}

impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}
