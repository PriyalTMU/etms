// T44 / US26: My Tickets   T43 / US25: view QR e-ticket
// T45 / US27: ticket shows its event   T46 / US28: open one ticket with its details and QR code
const express = require('express');
const { ROLES } = require('../models/userModel');
const { requireRole } = require('../middleware/auth');
const { isTicketCode } = require('../lib/ticketCode');
const { ticketQrSvg } = require('../lib/ticketQr');
const { localDateString } = require('../shared/eventValidation');

function pad(n) {
  return String(n).padStart(2, '0');
}

// T82-T84 / US42-US44: what the student is told when a cancellation can't go through
const CANCEL_FAIL = {
  ALREADY_CANCELLED: { status: 409, error: 'This ticket is already cancelled.' },
  ALREADY_USED: { status: 409, error: 'This ticket has already been used to check in, so it can no longer be cancelled.' },
  EVENT_STARTED: { status: 409, error: 'This event has already started, so the ticket can no longer be cancelled.' },
};

function createTicketRoutes({ tickets, events, now = () => new Date() }) {
  const router = express.Router();
  const studentOnly = requireRole(ROLES.STUDENT);

  const withTiming = (ticket) => ({ ...ticket, upcoming: ticket.event.date >= localDateString(now()) });

  // GET /api/my/tickets  -> every ticket the logged-in student holds, soonest event first
  router.get('/my/tickets', studentOnly, (req, res) => {
    res.json({ tickets: tickets.listByStudent(req.session.user.id).map(withTiming) });
  });

  // GET /api/tickets/:code  -> one ticket with its event information and QR code.
  // Students can only open their own tickets; anything else gets the same 404,
  // so nobody can find out whether someone else's ticket code exists.
  router.get('/tickets/:code', studentOnly, async (req, res, next) => {
    try {
      const code = req.params.code;
      const ticket = isTicketCode(code) ? tickets.findByCode(code) : null;
      if (!ticket || ticket.studentId !== req.session.user.id) {
        return res.status(404).json({ error: 'Ticket not found.' });
      }
      res.json({ ticket: withTiming(ticket), qrSvg: await ticketQrSvg(ticket.code) });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/tickets/:code/cancel  -> US42 cancel my own active ticket before the event
  // US43: the spot goes back to the event · US44: clear confirmation or reason
  router.post('/tickets/:code/cancel', studentOnly, (req, res) => {
    const code = req.params.code;
    const ticket = isTicketCode(code) ? tickets.findByCode(code) : null;
    // Someone else's ticket gets the same answer as a ticket that doesn't exist
    if (!ticket || ticket.studentId !== req.session.user.id) return res.status(404).json({ error: 'Ticket not found.' });

    const d = now();
    const started = ticket.event.date < localDateString(d) ||
      (ticket.event.date === localDateString(d) && ticket.event.time <= `${pad(d.getHours())}:${pad(d.getMinutes())}`);
    if (ticket.status === 'active' && started) {
      return res.status(409).json({ code: 'EVENT_STARTED', error: CANCEL_FAIL.EVENT_STARTED.error });
    }

    const result = tickets.cancel(code, req.session.user.id, d.toISOString());
    if (!result.ok) {
      if (result.reason === 'NOT_FOUND') return res.status(404).json({ error: 'Ticket not found.' });
      const fail = CANCEL_FAIL[result.reason];
      return res.status(fail.status).json({ code: result.reason, error: fail.error, ticket: result.ticket || null });
    }
    const event = events ? events.findById(ticket.eventId) : null;
    res.json({
      ticket: withTiming(result.ticket),
      event,
      message: `Your ticket for "${ticket.event.title}" has been cancelled. Your spot has been released for another student.`,
    });
  });

  return router;
}

module.exports = { createTicketRoutes };
