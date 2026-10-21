// T34 / US17: register for an event (reserve a ticket)
// T38 / US20: registration stops at capacity   T39 / US21: clear "event full" rejection
// T40 / US22: no duplicate active registrations
const express = require('express');
const { ROLES } = require('../models/userModel');
const { currentUser } = require('../middleware/auth');
const { localDateString } = require('../shared/eventValidation');

function pad(n) {
  return String(n).padStart(2, '0');
}

function parseEventId(raw) {
  return /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

function createRegistrationRoutes({ events, tickets, now = () => new Date() }) {
  const router = express.Router();

  /** An event that has already started (or is in the past) can't be registered for. */
  function hasStarted(event) {
    const d = now();
    const today = localDateString(d);
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return event.date < today || (event.date === today && event.time <= time);
  }

  // POST /api/events/:id/register  (students only)
  router.post('/events/:id/register', (req, res) => {
    const user = currentUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Please log in with your student account to register.', login: '/login' });
    }
    if (user.role !== ROLES.STUDENT) {
      return res.status(403).json({ error: 'Only student accounts can register for events.' });
    }

    const id = parseEventId(req.params.id);
    const event = id && events.findById(id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    if (hasStarted(event)) {
      return res.status(400).json({ error: 'Registration is closed because this event has already started.', code: 'EVENT_STARTED' });
    }

    const result = tickets.register(event.id, user.id, event.capacity);
    if (!result.ok && result.reason === 'DUPLICATE') {
      return res.status(409).json({
        error: 'You already have a ticket for this event.',
        code: 'ALREADY_REGISTERED',
        ticketCode: result.ticket ? result.ticket.code : null,
      });
    }
    if (!result.ok && result.reason === 'FULL') {
      return res.status(409).json({
        error: 'Sorry, this event is full. No more tickets can be issued.',
        code: 'EVENT_FULL',
        event: events.findById(event.id),
      });
    }
    return res.status(201).json({
      ticket: result.ticket,
      event: events.findById(event.id),
      redirect: `/tickets/${result.ticket.code}?new=1`,
    });
  });

  // GET /api/events/:id/registration  -> what the details page should show for this visitor
  router.get('/events/:id/registration', (req, res) => {
    const id = parseEventId(req.params.id);
    const event = id && events.findById(id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    const user = currentUser(req);
    const ticket = user && user.role === ROLES.STUDENT ? tickets.findActiveFor(event.id, user.id) : null;
    res.json({
      role: user ? user.role : null,
      ticketCode: ticket ? ticket.code : null,
      isFull: event.isFull,
      ticketsRemaining: event.ticketsRemaining,
      started: hasStarted(event),
    });
  });

  return router;
}

module.exports = { createRegistrationRoutes };
