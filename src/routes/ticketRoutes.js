// T44 / US26: My Tickets   T43 / US25: view QR e-ticket
// T45 / US27: ticket shows its event   T46 / US28: open one ticket with its details and QR code
const express = require('express');
const { ROLES } = require('../models/userModel');
const { requireRole } = require('../middleware/auth');
const { isTicketCode } = require('../lib/ticketCode');
const { ticketQrSvg } = require('../lib/ticketQr');
const { localDateString } = require('../shared/eventValidation');

function createTicketRoutes({ tickets, now = () => new Date() }) {
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

  return router;
}

module.exports = { createTicketRoutes };
