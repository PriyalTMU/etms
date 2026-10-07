// T08: database connection.
// Uses Node's built-in SQLite module (node:sqlite), so nobody has to install a database server.
const fs = require('node:fs');
const path = require('node:path');

const MIN_NODE = [22, 13, 0];

/** True if this Node version has the built-in SQLite module switched on. */
function nodeVersionOk(version = process.versions.node) {
  const [a, b, c] = version.split('.').map(Number);
  for (const [have, need] of [[a, MIN_NODE[0]], [b, MIN_NODE[1]], [c, MIN_NODE[2]]]) {
    if (have > need) return true;
    if (have < need) return false;
  }
  return true;
}

function loadSqlite() {
  try {
    return require('node:sqlite');
  } catch (err) {
    const msg =
      `ETMS needs Node.js ${MIN_NODE.join('.')} or newer (you have ${process.versions.node}).\n` +
      'Install the LTS version from https://nodejs.org, reopen your terminal, then run `npm install` and `npm start` again.';
    const e = new Error(msg);
    e.cause = err;
    throw e;
  }
}

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

/**
 * Open (or create) a SQLite database and make sure the tables exist.
 * @param {string} dbPath file path, or ':memory:' for tests
 */
function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const { DatabaseSync } = loadSqlite();
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  return db;
}

module.exports = { openDatabase, nodeVersionOk, MIN_NODE };
