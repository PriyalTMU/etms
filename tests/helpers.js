const request = require('supertest');
const { openDatabase } = require('../src/db/database');
const { createApp } = require('../src/app');
const { seedIfEmpty } = require('../src/db/seed');
const { localDateString } = require('../src/shared/eventValidation');

const ORGANIZER = { email: 'organizer@etms.test', password: 'Organizer123!' };
const ORGANIZER_2 = { email: 'robotics@etms.test', password: 'Organizer123!' };
const STUDENT = { email: 'student@etms.test', password: 'Student123!' };

/**
 * Fresh app + in-memory database for each test file.
 * Adds a TEST-ONLY route to log a student in, because student login (US02) is a separate story.
 */
function makeTestApp() {
  const db = openDatabase(':memory:');
  seedIfEmpty(db);
  const app = createApp({
    db,
    sessionSecret: 'test-secret',
    beforeRoutes(appRef, { users }) {
      appRef.post('/__test__/login-as', (req, res) => {
        const user = users.authenticate(req.body.email, req.body.password);
        if (!user) return res.status(401).end();
        req.session.user = user;
        res.json({ user });
      });
    },
  });
  return { app, db };
}

async function loginOrganizer(app, creds = ORGANIZER) {
  const agent = request.agent(app);
  const res = await agent.post('/api/organizer/login').send(creds);
  if (res.status !== 200) throw new Error(`organizer login failed: ${res.status}`);
  return agent;
}

async function loginStudent(app) {
  const agent = request.agent(app);
  await agent.post('/__test__/login-as').send(STUDENT).expect(200);
  return agent;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateString(d);
}

function validEvent(overrides = {}) {
  return {
    title: 'Sprint 1 Demo Night',
    description: 'Come see what Team 03 built this sprint.',
    date: daysFromNow(7),
    time: '18:00',
    location: 'ENG 103',
    capacity: '75',
    ...overrides,
  };
}

module.exports = { makeTestApp, loginOrganizer, loginStudent, validEvent, daysFromNow, ORGANIZER, ORGANIZER_2, STUDENT, request };
