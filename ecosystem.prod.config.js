module.exports = {
  apps: [
    {
      name: 'auth-module-prod-sso',
      script: 'server.js',
      node_args: '--max-http-header-size=1024000', // 1000KB header size limit
      instances: '1', // One instanse
      autorestart: true, // Automatically restart if the app crashes
      watch: false, // Don't watch files in production
      max_memory_restart: '2G', // Restart if memory usage exceeds 2GB
      env: {
        NODE_ENV: 'production'
      },
      log_file: './log/pm2-prod.log',
      out_file: './log/pm2-prod-out.log',
      error_file: './log/pm2-prod-error.log',
      time: true
    }
  ]
};