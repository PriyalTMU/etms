// Organizer-only pages are served from src/pages (NOT the public folder),
// so they can only be loaded through these guarded routes (US06).
const path = require('node:path');
const express = require('express');
const { ROLES } = require('../models/userModel');
const { requireRolePage, currentUser } = require('../middleware/auth');
const { canCheckIn } = require('./volunteerRoutes');

const PAGES = path.join(__dirname, '..', 'pages');
const LOGIN_PATH = '/organizer/login';

function createPageRoutes({ events, checkins } = {}) {
  const router = express.Router();
  const organizerPage = requireRolePage(ROLES.ORGANIZER, LOGIN_PATH);

  router.get(LOGIN_PATH, (req, res) => {
    const user = currentUser(req);
    if (user && user.role === ROLES.ORGANIZER) return res.redirect('/organizer');
    res.sendFile(path.join(PAGES, 'organizer', 'login.html'));
  });

  router.get('/organizer', organizerPage, (req, res) => {
    res.sendFile(path.join(PAGES, 'organizer', 'dashboard.html'));
  });

  router.get('/organizer/events/new', organizerPage, (req, res) => {
    res.sendFile(path.join(PAGES, 'organizer', 'create-event.html'));
  });

  // Student account pages (US01, US02). Already-logged-in students go straight to the event list.
  const studentRedirect = (file) => (req, res) => {
    const user = currentUser(req);
    if (user && user.role === ROLES.STUDENT) return res.redirect('/events');
    res.sendFile(path.join(PAGES, 'student', file));
  };
  router.get('/signup', studentRedirect('signup.html'));
  router.get('/login', studentRedirect('login.html'));

  // Attendee event pages (US12, US14, US15). Open to everyone so students can browse;
  // the data comes from the public /api/events endpoints.
  router.get('/events', (req, res) => {
    res.sendFile(path.join(PAGES, 'events', 'list.html'));
  });

  router.get('/events/:id', (req, res) => {
    res.sendFile(path.join(PAGES, 'events', 'details.html'));
  });

  // Sprint 2 student ticket pages (US25-US28). Students only: logged-out visitors go to the
  // student login and come back afterwards; organizers get the Access denied page.
  const studentPage = requireRolePage(ROLES.STUDENT, '/login');
  router.get('/my-tickets', studentPage, (req, res) => {
    res.set('Cache-Control', 'no-store, private');
    res.sendFile(path.join(PAGES, 'student', 'my-tickets.html'));
  });
  router.get('/tickets/:code', studentPage, (req, res) => {
    res.set('Cache-Control', 'no-store, private');
    res.sendFile(path.join(PAGES, 'student', 'ticket.html'));
  });

  // Sprint 3: organizer's page for one event - check-in volunteers (US29) and attendance (US37, US38)
  router.get('/organizer/events/:id', organizerPage, (req, res, next) => {
    if (!/^\d+$/.test(req.params.id)) return next();
    res.sendFile(path.join(PAGES, 'organizer', 'manage-event.html'));
  });

  // Sprint 3: volunteer check-in (US30, US31). Logged-out visitors go to the student login;
  // anyone without access to the event gets a clear "no check-in access" page.
  const needLogin = (req, res, next) => {
    if (currentUser(req)) return next();
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  };
  router.get('/checkin', needLogin, (req, res) => {
    res.set('Cache-Control', 'no-store, private');
    res.sendFile(path.join(PAGES, 'checkin', 'events.html'));
  });
  router.get('/checkin/events/:id', needLogin, (req, res) => {
    res.set('Cache-Control', 'no-store, private');
    const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : null;
    const event = id && events ? events.findById(id) : null;
    if (!event || !canCheckIn(currentUser(req), event, checkins)) {
      return res.status(403).type('html').send(noCheckinAccessPage());
    }
    res.sendFile(path.join(PAGES, 'checkin', 'scan.html'));
  });

  return router;
}

function noCheckinAccessPage() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>No check-in access · ETMS</title><link rel="stylesheet" href="/css/styles.css"></head>
<body><main class="container narrow">
<div class="card"><h1>No check-in access</h1>
<p>You do not have check-in access for this event. Only volunteers the organizer has added, and the event's organizer, can check in attendees.</p>
<p><a class="btn" href="/checkin">My check-in events</a> <a class="btn secondary" href="/">Back to home</a></p></div>
</main></body></html>`;
}

module.exports = { createPageRoutes };
