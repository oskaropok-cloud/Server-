module.exports = {
  apps: [
    {
      name: "kardi",
      script: "src/app.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      },
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      max_memory_restart: "500M",
      watch: false,
      ignore_watch: ["node_modules", "logs"],
      max_restarts: 10,
      min_uptime: "10s",
      autorestart: true
    }
  ]
};
