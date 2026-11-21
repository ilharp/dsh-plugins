use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;

/// GitHub repository facts shared by the plugins that live in it.
///
/// Case-insensitive identity `(owner, repo)` is enforced by a unique index on
/// `(lower(owner), lower(repo))`; rows store canonical casing.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, DeriveEntityModel)]
#[sea_orm(table_name = "repository_v1")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(column_type = "String(StringLen::N(39))")]
    pub owner: String,
    #[sea_orm(column_type = "String(StringLen::N(100))")]
    pub repo: String,
    /// SPDX license id; empty string when GitHub detects no license.
    #[sea_orm(column_type = "String(StringLen::N(64))")]
    pub license: String,
    pub stars: Option<i32>,
    pub forks: Option<i32>,
    pub open_issues: Option<i32>,
    pub created_time: DateTime,
    pub updated_time: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
