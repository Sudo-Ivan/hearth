// SPDX-License-Identifier: AGPL-3.0-or-later

mod pseudonym;
mod router_impl;
mod shard_impl;
mod types;

use hearth_svc::config::{DatabaseBackend, Mode, ServiceConfig};
use hearth_svc::transport::NatsTransport;
use router_impl::UsersRouter;
use shard_impl::UsersShard;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    hearth_svc::init_tracing();
    let config = ServiceConfig::from_env()?;
    let transport =
        NatsTransport::connect(&config.nats_url, config.nats_auth_token.as_deref()).await?;

    tracing::info!(
        service = config.service_name,
        mode = ?config.mode,
        shard_id = config.shard_id,
        shard_count = config.shard_count,
        listen_addr = %config.listen_addr,
        "starting users service"
    );

    match config.mode {
        Mode::Router => hearth_svc::router::run_router(&config, UsersRouter, transport).await,
        Mode::Shard => {
            let shard = build_shard(&config).await?;
            hearth_svc::shard::run_shard(&config, shard, transport).await
        }
        Mode::Combined => {
            let shard = build_shard(&config).await?;
            hearth_svc::combined::run_combined(&config, UsersRouter, shard, transport).await
        }
    }
}

async fn build_shard(config: &ServiceConfig) -> anyhow::Result<UsersShard> {
    pseudonym::configure_from_env()?;
    match config.database_backend {
        DatabaseBackend::Postgres => {
            let postgres_config = hearth_svc::postgres::PostgresConfig::from_service_config(config);
            let pool = hearth_svc::postgres::connect(&postgres_config).await?;
            let kv = hearth_svc::postgres::KvClient::new(pool, &postgres_config)?;
            Ok(UsersShard::new_postgres(
                kv,
                config.cache_max_entries,
                config.cache_ttl,
            ))
        }
        DatabaseBackend::Cassandra => {
            #[cfg(feature = "scylla")]
            {
                let scylla_config = hearth_svc::scylla::ScyllaConfig::from_service_config(config);
                let db = hearth_svc::scylla::connect(&scylla_config).await?;
                UsersShard::new_scylla(db, config.cache_max_entries, config.cache_ttl).await
            }
            #[cfg(not(feature = "scylla"))]
            {
                anyhow::bail!("FLUXER_DATABASE_BACKEND=cassandra requires the scylla feature");
            }
        }
    }
}
