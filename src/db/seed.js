// T12: sample / seed data so the app can be demoed straight away.
// Organizer accounts are created here because organizers do not sign up themselves in Sprint 1.
const fs = require('node:fs');
const { createUserModel, ROLES } = require('../models/userModel');
const { createEventModel } = require('../models/eventModel');
const { localDateString } = require('../shared/eventValidation');

const DEMO_ACCOUNTS = [
  { name: 'Demo Organizer', email: 'organizer@etms.test', password: 'Organizer123!', role: ROLES.ORGANIZER, clubName: 'Computer Science Club' },
  { name: 'Robotics Organizer', email: 'robotics@etms.test', password: 'Organizer123!', role: ROLES.ORGANIZER, clubName: 'Robotics Club' },
  { name: 'Demo Student', email: 'student@etms.test', password: 'Student123!', role: ROLES.STUDENT },
];

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateString(d);
}

function seedIfEmpty(db) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return false;

  const users = createUserModel(db);
  const events = createEventModel(db);
  const created = DEMO_ACCOUNTS.map((a) => users.create(a));
  const [cs, robotics] = created;

  events.create(cs.id, {
    title: 'Intro to Git Workshop',
    description: 'Hands-on workshop covering branches, commits and pull requests. Bring a laptop.',
    date: daysFromNow(3), time: '17:00', location: 'ENG 103', capacity: 40,
  });
  events.create(cs.id, {
    title: 'Hackathon Kickoff Night',
    description: 'Meet teams, hear the challenge and grab some pizza before the weekend hackathon.',
    date: daysFromNow(10), time: '18:30', location: 'Student Learning Centre, Room 601', capacity: 120,
  });
  events.create(robotics.id, {
    title: 'Robotics Club Open House',
    description: 'See our competition robots, try the simulator and learn how to join a build team.',
    date: daysFromNow(6), time: '15:00', location: 'Kerr Hall East, Lab 2', capacity: 60,
  });
  return true;
}

module.exports = { seedIfEmpty, DEMO_ACCOUNTS };

// `npm run seed` / `npm run reset-db`
if (require.main === module) {
  const config = require('../config');
  const { openDatabase } = require('./database');
  if (process.argv.includes('--reset') && fs.existsSync(config.dbPath)) {
    fs.rmSync(config.dbPath);
    console.log('Deleted old database.');
  }
  const db = openDatabase(config.dbPath);
  console.log(seedIfEmpty(db) ? 'Seeded demo accounts and events.' : 'Database already has data - nothing seeded.');
  for (const a of DEMO_ACCOUNTS) console.log(`  ${a.role.padEnd(9)} ${a.email} / ${a.password}`);
}
