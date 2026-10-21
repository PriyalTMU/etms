// Organizer-only pages are served from src/pages (NOT the public folder),
// so they can only be loaded through these guarded routes (US06).
const path = require('node:path');
const express = require('express');
const { ROLES } = require('../models/userModel');
const { requireRolePage, currentUser } = require('../middleware/auth');

const PAGES = path.join(__dirname, '..', 'pages');
const LOGIN_PATH = '/organizer/login';

function createPageRoutes() {
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

  return router;
}

module.exports = { createPageRoutes };
