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
