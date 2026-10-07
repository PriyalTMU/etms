// T18 / US08: create event   T19 / US09: event validation
const express = require('express');
const { ROLES } = require('../models/userModel');
const { requireRole } = require('../middleware/auth');
const { validateEvent } = require('../shared/eventValidation');

function createEventRoutes({ events }) {
  const router = express.Router();
  const organizerOnly = requireRole(ROLES.ORGANIZER);

  // POST /api/events  (organizer only) - create a new event
  router.post('/events', organizerOnly, (req, res) => {
    const result = validateEvent(req.body);
    if (!result.valid) {
      return res.status(400).json({
        error: 'The event was not created. Please fix the highlighted fields.',
        errors: result.errors,
      });
    }
    const event = events.create(req.session.user.id, result.values);
    return res.status(201).json({ event });
  });

  // GET /api/organizer/events  (organizer only) - events created by the logged-in organizer
  router.get('/organizer/events', organizerOnly, (req, res) => {
    res.json({ events: events.listByOrganizer(req.session.user.id) });
  });

  return router;
}

module.exports = { createEventRoutes };
