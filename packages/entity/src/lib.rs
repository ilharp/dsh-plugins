//! SeaORM entities for dp-server.
//!
//! Conventions: table names carry a `_v1` suffix; primary keys are
//! auto-increment `id`; time columns are naive UTC timestamps managed by the
//! database (`created_time` defaults to `now()`, `updated_time` is maintained
//! by trigger).

pub mod evaluation;
pub mod plugin;
pub mod plugin_version;
pub mod repository;

pub mod prelude {
    pub use crate::evaluation::Entity as Evaluation;
    pub use crate::plugin::Entity as Plugin;
    pub use crate::plugin_version::Entity as PluginVersion;
    pub use crate::repository::Entity as Repository;
}
