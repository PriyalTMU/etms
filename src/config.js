const path = require('node:path');

// Load .env if it exists (Node 22 built-in, no dotenv package needed).
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
  /* no .env file - use defaults */
}

const ROOT = path.join(__dirname, '..');

module.exports = {
  port: Number(process.env.PORT) || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'etms-dev-secret-change-me',
  dbPath: path.resolve(ROOT, process.env.DB_PATH || 'data/etms.db'),
};
