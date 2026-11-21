use sea_orm::entity::prelude::*;
use serde::Deserialize;
use serde::Serialize;

/// One `(package_version, dsh_version)` pair. `seq` is the per-plugin
/// sequence number of recorded versions (1-based); the newest version is
/// the highest sequence.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, DeriveEntityModel)]
#[sea_orm(table_name = "plugin_version_v1")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub plugin_id: i32,
    pub seq: i32,
    #[sea_orm(column_type = "String(StringLen::N(64))")]
    pub package_version: String,
    #[sea_orm(column_type = "String(StringLen::N(64))")]
    pub dsh_version: String,
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
