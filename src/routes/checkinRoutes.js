// T58-T60 / T63-T65: ticket validation and check-in
// US32 enter or scan a ticket · US33 valid result · US34 invalid / wrong event rejected
// US35 already-used rejected · US36 valid ticket marked checked in (saved)
const express = require('express');
const { currentUser } = require('../middleware/auth');
const { normalizeTicketInput } = require('../lib/ticketInput');
const { canCheckIn, parseId } = require('./volunteerRoutes');

// The replies agreed at Sprint Planning, shown on the volunteer's screen (US33-US35)
const MESSAGES = {
  VALID: 'Valid ticket – checked in. Let them in.',
  INVALID: 'Invalid ticket – this code does not match any ticket. Do not let them in.',
  UNREADABLE: 'Could not read a ticket code. Check the code and try again.',
  WRONG_EVENT: 'Invalid ticket – this ticket is for a different event.',
  ALREADY_USED: 'Already used – this ticket was already checked in.',
  CANCELLED: 'Invalid ticket – this ticket was cancelled.',
  EVENT_CANCELLED: 'Do not let in – this event has been cancelled by the organizer.',
};

function createCheckinRoutes({ events, checkins, now = () => new Date() }) {
  const router = express.Router();

  /** Logged in and allowed to check in for this event, or send the right error. */
  function access(req, res) {
    const user = currentUser(req);
    if (!user) { res.status(401).json({ error: 'Please log in to use check-in.' }); return null; }
    const id = parseId(req.params.id);
    const event = id && events.findById(id);
    if (!event || !canCheckIn(user, event, checkins)) {
      res.status(403).json({ error: 'You do not have check-in access for this event.' });
      return null;
    }
    return { user, event };
  }

  // GET /api/checkin/events/:id/stats  -> issued / checked in so far
  router.get('/checkin/events/:id/stats', (req, res) => {
    const a = access(req, res);
    if (a) res.json(checkins.stats(a.event.id));
  });

  // POST /api/checkin/events/:id/scan  { code }  -> one scan = validate + check in if valid
  router.post('/checkin/events/:id/scan', (req, res) => {
    const a = access(req, res);
    if (!a) return;
    const code = normalizeTicketInput(req.body.code);
    if (!code) {
      // Unreadable input never reaches the database and never creates a check-in (US32, US34)
      return res.json({ result: 'UNREADABLE', valid: false, message: MESSAGES.UNREADABLE, stats: checkins.stats(a.event.id) });
    }
    const out = checkins.scan(a.event.id, code, a.user.id, now().toISOString());
    res.json({
      ...out,
      code,
      valid: out.result === 'VALID',
      message: MESSAGES[out.result],
      stats: checkins.stats(a.event.id),
    });
  });

  return router;
}

module.exports = { createCheckinRoutes, MESSAGES };
