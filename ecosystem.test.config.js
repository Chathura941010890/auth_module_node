module.exports = {
  apps: [
    {
      name: 'auth-module-test',
      script: 'server.js',
      node_args: '--max-http-header-size=1024000', // 1000KB header size limit
      instances: '1', // Number of instances to run
      autorestart: true, // Automatically restart if the app crashes
      watch: false, // Watch for file changes and restart
      max_memory_restart: '1G', // Restart if memory usage exceeds 1GB
      env: {
        NODE_ENV: 'test'
      },
      log_file: './log/pm2-test.log',
      out_file: './log/pm2-test-out.log',
      error_file: './log/pm2-test-error.log',
      time: true
    }
  ]
};