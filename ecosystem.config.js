/**
 * PM2 process definition used by the production image.
 *
 * Started via `pm2-runtime start ecosystem.config.js --env production`, which
 * keeps PM2 in the foreground as PID 1 so Docker sees the real process state
 * and signals reach the workers.
 *
 * Note on horizontal scaling: the rate limiter and the cache fall back to
 * in-memory storage. Every worker then keeps its own counters, so N instances
 * allow roughly N x RATE_LIMIT_LIMIT requests. Point the throttler and cache at
 * Redis before raising PM2_INSTANCES above 1.
 */
module.exports = {
  apps: [
    {
      name: 'backend-template',
      // Compiled entrypoint. Root-level .ts files push the compiler rootDir up,
      // so sources emit to dist/src — not dist.
      script: 'dist/src/main.js',

      // `max` uses every available core. Override with PM2_INSTANCES.
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',

      // Let the platform restart the container instead of thrashing in place.
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 2000,

      // Recycle a worker that leaks past this ceiling.
      max_memory_restart: process.env.PM2_MAX_MEMORY || '512M',

      // Docker collects stdout/stderr; no PM2-side log files.
      out_file: '/dev/stdout',
      error_file: '/dev/stderr',
      merge_logs: true,
      time: false,

      // Wait for in-flight requests before killing a worker.
      kill_timeout: 10000,
      listen_timeout: 10000,

      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
