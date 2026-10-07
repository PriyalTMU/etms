// Builds the Express app. Kept separate from server.js so tests can create an app
// with an in-memory database.
const path = require('node:path');
const express = require('express');
const session = require('express-session');

const { createUserModel } = require('./models/userModel');
const { createEventModel } = require('./models/eventModel');
const { createAuthRoutes } = require('./routes/authRoutes');
const { createEventRoutes } = require('./routes/eventRoutes');
const { createPageRoutes } = require('./routes/pageRoutes');
const { createPublicEventRoutes } = require('./routes/publicEventRoutes');
const { createStudentRoutes } = require('./routes/studentRoutes');

/**
 * @param {object} options
 * @param {import('node:sqlite').DatabaseSync} options.db
 * @param {string} options.sessionSecret
 * @param {(app: express.Express, models: object) => void} [options.beforeRoutes] hook used by tests
 * @param {() => Date} [options.now] clock used to decide which events are upcoming (tests can fix it)
 */
function createApp({ db, sessionSecret, beforeRoutes, now } = {}) {
  if (!db) throw new Error('createApp needs a database');
  const users = createUserModel(db);
  const events = createEventModel(db);

  const app = express();
  app.disable('x-powered-by');
  app.locals.models = { users, events };

  app.use(express.json({ limit: '50kb' }));
  app.use(
    session({
      name: 'etms.sid',
      secret: sessionSecret || 'etms-dev-secret-change-me',
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 8 },
    })
  );

  // API write requests must be JSON (blocks simple cross-site form posts).
  app.use('/api', (req, res, next) => {
    if (req.method === 'POST' && req.headers['content-length'] !== '0' && !req.is('application/json')) {
      return res.status(415).json({ error: 'Requests must be sent as JSON.' });
    }
    next();
  });

  if (beforeRoutes) beforeRoutes(app, { users, events });

  app.use('/api', createAuthRoutes({ users }));
  app.use('/api', createStudentRoutes({ users }));
  app.use('/api', createEventRoutes({ events }));
  app.use('/api', createPublicEventRoutes({ events, now }));
  app.use(createPageRoutes());

  // Static files: public pages, CSS, JS, and the shared validator for the browser.
  app.use('/shared', express.static(path.join(__dirname, 'shared')));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((req, res) => res.status(404).type('text').send('Page not found'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'The request body is not valid JSON.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}

module.exports = { createApp };
