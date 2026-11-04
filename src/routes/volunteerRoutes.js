// T55 / US29: organizer gives a volunteer check-in access for one event
// T56 / US30: volunteer opens check-in for their assigned event
// T57 / US31: everyone else is blocked from check-in
const express = require('express');
const { ROLES } = require('../models/userModel');
const { requireRole, currentUser } = require('../middleware/auth');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseId(raw) {
  return /^\d+$/.test(String(raw)) && Number(raw) > 0 ? Number(raw) : null;
}

/** May this user run check-in for this event? Assigned volunteers, and the event's own organizer. */
function canCheckIn(user, event, checkins) {
  if (!user || !event) return false;
  if (user.role === ROLES.ORGANIZER) return event.organizerId === user.id;
  if (user.role === ROLES.STUDENT) return checkins.isAssigned(event.id, user.id);
  return false;
}

function createVolunteerRoutes({ users, events, checkins }) {
  const router = express.Router();
  const organizerOnly = requireRole(ROLES.ORGANIZER);

  /** The organizer's own event, or null (other organizers' events look the same as missing ones). */
  function ownEvent(req) {
    const id = parseId(req.params.id);
    const event = id && events.findById(id);
    return event && event.organizerId === req.session.user.id ? event : null;
  }

  // GET /api/organizer/events/:id/volunteers
  router.get('/organizer/events/:id/volunteers', organizerOnly, (req, res) => {
    const event = ownEvent(req);
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ event, volunteers: checkins.listVolunteers(event.id) });
  });

  // POST /api/organizer/events/:id/volunteers  { email }
  router.post('/organizer/events/:id/volunteers', organizerOnly, (req, res) => {
    const event = ownEvent(req);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) return res.status(400).json({ error: "Enter the volunteer's email address." });
    if (!EMAIL.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

    const row = users.findByEmail(email);
    if (!row) {
      return res.status(404).json({ error: 'No student account uses that email. Ask the volunteer to create a student account first.' });
    }
    if (row.role !== ROLES.STUDENT) {
      return res.status(400).json({ error: 'That is an organizer account. Volunteers must use a student account.' });
    }
    if (!checkins.assign(event.id, row.id, req.session.user.id)) {
      return res.status(409).json({ error: `${row.name} already has check-in access for this event.` });
    }
    const volunteer = checkins.listVolunteers(event.id).find((v) => v.id === row.id);
    return res.status(201).json({ volunteer, message: `${row.name} can now check in attendees for ${event.title}.` });
  });

  // GET /api/checkin/events  -> events the logged-in user may run check-in for
  router.get('/checkin/events', (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in to use check-in.' });
    const list = user.role === ROLES.ORGANIZER
      ? events.listByOrganizer(user.id).map((e) => ({ id: e.id, title: e.title, date: e.date, time: e.time, location: e.location, clubName: user.clubName }))
      : checkins.eventsForVolunteer(user.id);
    res.json({ events: list });
  });

  // GET /api/checkin/events/:id  -> the event being managed (only for people allowed to check in)
  router.get('/checkin/events/:id', (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ error: 'Please log in to use check-in.' });
    const id = parseId(req.params.id);
    const event = id && events.findById(id);
    if (!event || !canCheckIn(user, event, checkins)) {
      return res.status(403).json({ error: 'You do not have check-in access for this event.' });
    }
    res.json({
      event: { id: event.id, title: event.title, date: event.date, time: event.time, location: event.location, clubName: event.clubName, capacity: event.capacity },
      role: user.role,
    });
  });

  return router;
}

module.exports = { createVolunteerRoutes, canCheckIn, parseId };
