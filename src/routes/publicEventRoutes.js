// Attendee-facing event routes (no organizer role needed).
// T21 / US12: retrieve upcoming events   T25 / US15: retrieve one selected event
const express = require('express');
const { localDateString } = require('../shared/eventValidation');

function pad(n) {
  return String(n).padStart(2, '0');
}

function createPublicEventRoutes({ events, now = () => new Date() }) {
  const router = express.Router();

  // GET /api/events  -> upcoming events, soonest first
  router.get('/events', (req, res) => {
    const d = now();
    const list = events.listUpcoming(localDateString(d), `${pad(d.getHours())}:${pad(d.getMinutes())}`);
    res.json({ events: list });
  });

  // GET /api/events/:id  -> full details of one event
  router.get('/events/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || !/^\d+$/.test(req.params.id)) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    const event = events.findById(id);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event });
  });

  return router;
}

module.exports = { createPublicEventRoutes };
