use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;

/// One indexed plugin. `id` is the stable external identity used by
/// `/plugins/<id>` URLs; fetch is the sole writer and never deletes.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, DeriveEntityModel)]
#[sea_orm(table_name = "plugin_v1")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(column_type = "String(StringLen::N(214))")]
    pub name: String,
    /// npm name; not unique — lookups keep first-match-wins by lowest id;
    /// empty string when the plugin has no npm identity.
    #[sea_orm(column_type = "String(StringLen::N(214))")]
    pub npm_name: String,
    /// GitHub repository; null for npm-only plugins.
    pub repository_id: Option<i32>,
    /// Plugin-level path inside the repository (monorepo subdirectory);
    /// empty string = repository root.
    #[sea_orm(column_type = "String(StringLen::N(128))")]
    pub github_path: String,
    pub created_time: DateTime,
    pub updated_time: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::plugin_version::Entity")]
    PluginVersion,
    #[sea_orm(has_many = "super::evaluation::Entity")]
    Evaluation,
    #[sea_orm(
        belongs_to = "super::repository::Entity",
        from = "Column::RepositoryId",
        to = "super::repository::Column::Id"
    )]
    Repository,
}

impl Related<super::plugin_version::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::PluginVersion.def()
    }
}

impl Related<super::evaluation::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Evaluation.def()
    }
}

impl Related<super::repository::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Repository.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
