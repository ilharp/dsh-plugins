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
    pub owner: String,
    pub repo: String,
    pub license: Option<String>,
    pub stars: Option<i32>,
    pub forks: Option<i32>,
    pub open_issues: Option<i32>,
    pub created_time: DateTime,
    pub updated_time: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
