const { nodeVersionOk, MIN_NODE } = require('./db/database');

if (!nodeVersionOk()) {
  console.error(
    `\nETMS needs Node.js ${MIN_NODE.join('.')} or newer - you have ${process.versions.node}.\n` +
      'Install the LTS version from https://nodejs.org, reopen your terminal, then run `npm install` and `npm start` again.\n'
  );
  process.exit(1);
}

const config = require('./config');
const { openDatabase } = require('./db/database');
const { createApp } = require('./app');
const { seedIfEmpty } = require('./db/seed');

const db = openDatabase(config.dbPath);
seedIfEmpty(db);

const app = createApp({ db, sessionSecret: config.sessionSecret });

app.listen(config.port, () => {
  console.log(`ETMS running at http://localhost:${config.port}`);
  console.log(`Organizer login: http://localhost:${config.port}/organizer/login`);
});
