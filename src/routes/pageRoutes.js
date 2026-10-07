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

  return router;
}

module.exports = { createPageRoutes };
