// PM2 Ecosystem Config for Hriatrengna
// ─────────────────────────────────────
// Start:       pm2 start ecosystem.config.js --env production
// Restart:     pm2 restart all
// Logs:        pm2 logs
// Status:      pm2 status
// Save state:  pm2 save
//
// NOTE: Run this file from /var/www/memorialqr (the project root)
//       The backend folder must be named "backend" at that root.
//       If it is named "memorialqr-api", rename it first:
//         mv memorialqr-api backend

module.exports = {
  apps: [
    {
      name: 'memorialqr-api',
      script: '../backend/src/server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: '../logs/api-error.log',
      out_file:   '../logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: 'memorialqr-frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '../frontend',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '../logs/frontend-error.log',
      out_file:   '../logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
