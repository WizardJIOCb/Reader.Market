module.exports = {
  apps: [{
    name: 'ollama-reader',
    script: './dist/index.cjs',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5001,
      DATABASE_URL: 'postgresql://booksuser:bookspassword@localhost:5432/booksdb?schema=public',
      JWT_SECRET: '84k2ia4/ChIUw8oZQNaQ7fVEGLBus4NAcH9hrXGku2o=',
      OLLAMA_HOST: 'http://localhost:11434',
      OLLAMA_MODEL: 'llama2'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G'
  }]
};
