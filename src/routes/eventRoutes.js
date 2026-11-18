// T18 / US08: create event   T19 / US09: event validation
// Sprint 4 - T77/T78 / US39: edit an event · T80/T81 / US41: cancel an event · T92 / US51: free or demo-paid
const express = require('express');
const { ROLES } = require('../models/userModel');
const { requireRole } = require('../middleware/auth');
const { validateEvent, localDateString } = require('../shared/eventValidation');

const REASON_MAX = 300;

function pad(n) {
  return String(n).padStart(2, '0');
}

function createEventRoutes({ events, now = () => new Date() }) {
  const router = express.Router();
  const organizerOnly = requireRole(ROLES.ORGANIZER);

  /** An event that has already started can no longer be edited or cancelled. */
  function hasStarted(event) {
    const d = now();
    const today = localDateString(d);
    return event.date < today || (event.date === today && event.time <= `${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }

  /** The logged-in organizer's own event, or null. Another organizer's event looks "not found". */
  function ownEvent(req) {
    if (!/^\d+$/.test(req.params.id)) return null;
    const event = events.findById(Number(req.params.id));
    return event && event.organizerId === req.session.user.id ? event : null;
  }

  // POST /api/events  (organizer only) - create a new event
  router.post('/events', organizerOnly, (req, res) => {
    const result = validateEvent(req.body, now());
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

  // GET /api/organizer/events/:id  - one of my events, for the edit form (US39)
  router.get('/organizer/events/:id', organizerOnly, (req, res) => {
    const event = ownEvent(req);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event, started: hasStarted(event) });
  });

  // PUT /api/organizer/events/:id  - save changes to one of my events (US39, US51)
  router.put('/organizer/events/:id', organizerOnly, (req, res) => {
    if (!req.is('application/json')) return res.status(415).json({ error: 'Requests must be sent as JSON.' });
    const event = ownEvent(req);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    if (event.isCancelled) {
      return res.status(409).json({ error: 'This event has been cancelled, so it can no longer be edited.', code: 'EVENT_CANCELLED' });
    }
    if (hasStarted(event)) {
      return res.status(409).json({ error: 'This event has already started, so it can no longer be edited.', code: 'EVENT_STARTED' });
    }
    const result = validateEvent(req.body, now(), { minCapacity: event.ticketsIssued });
    if (!result.valid) {
      return res.status(400).json({ error: 'Your changes were not saved. Please fix the highlighted fields.', errors: result.errors });
    }
    const updated = events.update(event.id, req.session.user.id, result.values, now().toISOString());
    if (!updated) return res.status(409).json({ error: 'This event changed while you were editing it. Reload the page and try again.' });
    res.json({ event: updated, message: 'Your changes were saved. Students now see the updated event.' });
  });

  // POST /api/organizer/events/:id/cancel  { reason? }  - cancel one of my events (US41)
  router.post('/organizer/events/:id/cancel', organizerOnly, (req, res) => {
    const event = ownEvent(req);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    if (event.isCancelled) {
      return res.status(409).json({ error: 'This event is already cancelled.', code: 'ALREADY_CANCELLED', event });
    }
    if (hasStarted(event)) {
      return res.status(409).json({ error: 'This event has already started, so it can no longer be cancelled.', code: 'EVENT_STARTED' });
    }
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().replace(/\s+/g, ' ') : '';
    if (reason.length > REASON_MAX) {
      return res.status(400).json({ error: `Keep the reason to ${REASON_MAX} characters or fewer.` });
    }
    const done = events.cancel(event.id, req.session.user.id, reason, now().toISOString());
    const latest = events.findById(event.id);
    if (!done) return res.status(409).json({ error: 'This event is already cancelled.', code: 'ALREADY_CANCELLED', event: latest });
    res.json({
      event: latest,
      message: `"${latest.title}" has been cancelled. Students can see that it is cancelled and can no longer register.`,
    });
  });

  return router;
}

module.exports = { createEventRoutes };
