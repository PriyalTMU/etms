// T13 / US01: attendee account creation
// T14 / US02: student login   T15 / US03: invalid login handling
const express = require('express');
const { ROLES } = require('../models/userModel');
const { validateSignup } = require('../shared/accountValidation');

function createStudentRoutes({ users }) {
  const router = express.Router();

  // POST /api/students/signup  { name, email, password, confirmPassword }
  router.post('/students/signup', (req, res) => {
    const result = validateSignup(req.body);
    if (!result.valid) {
      return res.status(400).json({
        error: 'Your account was not created. Please fix the highlighted fields.',
        errors: result.errors,
      });
    }

    const { name, email, password } = result.values;
    if (users.findByEmail(email)) {
      return res.status(409).json({
        error: 'Your account was not created.',
        errors: { email: 'An account with this email already exists. Try logging in instead.' },
      });
    }

    let user;
    try {
      user = users.create({ name, email, password, role: ROLES.STUDENT });
    } catch (err) {
      // Two sign-ups with the same email at the same moment: the UNIQUE rule in the DB catches it.
      if (/UNIQUE/i.test(String(err.message))) {
        return res.status(409).json({
          error: 'Your account was not created.',
          errors: { email: 'An account with this email already exists. Try logging in instead.' },
        });
      }
      throw err;
    }
    return res.status(201).json({ user, redirect: '/login?created=1' });
  });

  // POST /api/students/login  { email, password }
  router.post('/students/login', (req, res, next) => {
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      return res.status(400).json({ error: 'Enter both your email and password.' });
    }

    const user = users.authenticate(email, password);
    if (!user) {
      // US03: no access, one clear message (we don't say whether the email exists), session untouched.
      return res.status(401).json({ error: 'Incorrect email or password. Please try again.' });
    }
    if (user.role !== ROLES.STUDENT) {
      return res.status(403).json({
        error: 'This is an organizer account. Please use the organizer login.',
      });
    }

    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.user = user;
      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);
        res.json({ user, redirect: '/events' });
      });
    });
  });

  return router;
}

module.exports = { createStudentRoutes };
