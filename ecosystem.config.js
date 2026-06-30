module.exports = {
  apps: [
    {
      name: "kardi",
      script: "src/app.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};