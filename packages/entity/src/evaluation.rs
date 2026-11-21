use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;

/// Append-only evaluation event log for one plugin. Identity is
/// `(plugin_id, evaluated_at)`: `evaluated_at` is stamped when the
/// evaluation ran and travels with the results, so publish retries carrying
/// the same event are idempotent. `created_time` records when the event
/// landed in the database, which may differ on the resume path.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, DeriveEntityModel)]
#[sea_orm(table_name = "evaluation_v1")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub plugin_id: i32,
    /// Record format version (currently 1); a plain column, not optimistic
    /// locking.
    pub version: i32,
    /// 40-hex commit sha the evaluation ran against.
    pub sha: String,
    /// When the evaluation ran, stored as UTC without time zone.
    pub evaluated_at: DateTime,
    /// Evaluator image tag that produced the results.
    #[sea_orm(column_type = "String(StringLen::N(64))")]
    pub evaluator: String,
    /// Kebab-case item key -> pass; key presence means the item was evaluated.
    #[sea_orm(column_type = "JsonBinary")]
    pub result: Json,
    pub created_time: DateTime,
    pub updated_time: DateTime,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::plugin::Entity",
        from = "Column::PluginId",
        to = "super::plugin::Column::Id"
    )]
    Plugin,
}

impl Related<super::plugin::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Plugin.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
