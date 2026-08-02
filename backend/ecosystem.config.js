/**
 * ecosystem.config.js — PM2 Process Manager Configuration
 * ─────────────────────────────────────────────────────────────────────────────
 * PM2 keeps the NestJS backend running 24/7 on the restaurant PC.
 * It auto-restarts on crash and can start automatically on Windows boot.
 *
 * Usage:
 *   pm2 start ecosystem.config.js    → Start the backend
 *   pm2 save                          → Save current process list
 *   pm2 startup                       → Generate Windows startup command
 *   pm2 status                        → Check running status
 *   pm2 logs karvaan-backend          → View live logs
 *   pm2 restart karvaan-backend       → Restart after update
 */

module.exports = {
  apps: [
    {
      name: 'karvaan-backend',
      script: 'dist/main.js',         // Built output from `npm run build`
      cwd: __dirname,

      // ─── Startup ──────────────────────────────────────────────────────────
      instances: 1,                   // Single instance (SQLite is single-writer)
      exec_mode: 'fork',
      autorestart: true,              // Auto-restart on crash
      watch: false,                   // Don't watch files in production

      // ─── Resource Limits ──────────────────────────────────────────────────
      max_memory_restart: '300M',     // Restart if RAM exceeds 300MB
      min_uptime: '5s',               // Crash within 5s = unstable
      max_restarts: 10,               // Max restart attempts before giving up

      // ─── Logging ──────────────────────────────────────────────────────────
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // ─── Environment ──────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
    },
  ],
};
