// T16 / US05: organizer login (plus shared logout / "who am I").
const express = require('express');
const { ROLES } = require('../models/userModel');
const { currentUser } = require('../middleware/auth');

function createAuthRoutes({ users }) {
  const router = express.Router();

  // POST /api/organizer/login  { email, password }
  router.post('/organizer/login', (req, res, next) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Enter both your email and password.' });
    }

    const user = users.authenticate(email, password);
    if (!user) {
      // Same message for unknown email and wrong password, so we don't reveal which accounts exist.
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    if (user.role !== ROLES.ORGANIZER) {
      return res.status(403).json({
        error: 'This account is not an organizer account. Students should use the student login.',
        studentLogin: '/login',
      });
    }

    // New session id on login (prevents session fixation), then remember the user and their role.
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = user;
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.json({ user, redirect: '/organizer' });
      });
    });
  });

  // GET /api/auth/me  -> who is logged in (null if nobody)
  router.get('/auth/me', (req, res) => {
    res.json({ user: currentUser(req) });
  });

  // POST /api/auth/logout
  router.post('/auth/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('etms.sid');
      res.json({ ok: true });
    });
  });

  return router;
}

module.exports = { createAuthRoutes };
