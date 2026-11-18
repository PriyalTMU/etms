// Sprint 4 - T94 / US53: simulated checkout · T95 / US54: issue a ticket after a successful demo checkout
// US50: every failure has a reason the student can understand, and a failure never issues a ticket.
const express = require('express');
const { ROLES } = require('../models/userModel');
const { requireRole } = require('../middleware/auth');
const { localDateString } = require('../shared/eventValidation');
const { CANCELLED_MSG } = require('./registrationRoutes');

function pad(n) {
  return String(n).padStart(2, '0');
}

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

const FAIL = {
  EVENT_CANCELLED: { status: 409, error: CANCELLED_MSG },
  EVENT_STARTED: { status: 409, error: 'Registration is closed because this event has already started.' },
  EVENT_FULL: { status: 409, error: 'Sorry, this event is full. No ticket was issued and nothing was charged.' },
  ALREADY_REGISTERED: { status: 409, error: 'You already have a ticket for this event.' },
  NOT_PAID: { status: 409, error: 'This event is free – register from the event page instead.' },
  CHECKOUT_CLOSED: { status: 409, error: 'This checkout is closed. Start a new one from the event page.' },
};

function createCheckoutRoutes({ events, tickets, checkouts, now = () => new Date() }) {
  const router = express.Router();
  const studentOnly = requireRole(ROLES.STUDENT);

  function hasStarted(ev) {
    const d = now();
    const today = localDateString(d);
    return ev.date < today || (ev.date === today && ev.time <= `${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }

  function failure(res, reason, extra = {}) {
    const f = FAIL[reason] || { status: 400, error: 'The demo checkout could not be completed.' };
    return res.status(f.status).json({ code: reason, error: f.error, ...extra });
  }

  /** The logged-in student's own checkout, or null (someone else's looks "not found"). */
  function ownCheckout(req) {
    const token = req.params.token;
    if (!TOKEN_RE.test(token)) return null;
    const c = checkouts.findByToken(token);
    return c && c.studentId === req.session.user.id ? c : null;
  }

  // POST /api/events/:id/checkout  -> start (or reopen) a demo checkout for a demo-paid event
  router.post('/events/:id/checkout', (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) return res.status(401).json({ error: 'Please log in with your student account to get a ticket.', login: '/login' });
    if (user.role !== ROLES.STUDENT) return res.status(403).json({ error: 'Only student accounts can register for events.' });
    next();
  }, (req, res) => {
    const ev = /^\d+$/.test(req.params.id) ? events.findById(Number(req.params.id)) : null;
    if (!ev) return res.status(404).json({ error: 'Event not found.' });
    if (ev.isCancelled) return failure(res, 'EVENT_CANCELLED');
    if (hasStarted(ev)) return failure(res, 'EVENT_STARTED');
    if (ev.paymentType !== 'demo_paid') return failure(res, 'NOT_PAID');
    const existing = tickets.findActiveFor(ev.id, req.session.user.id);
    if (existing) return failure(res, 'ALREADY_REGISTERED', { ticketCode: existing.code });
    if (ev.isFull) return failure(res, 'EVENT_FULL', { event: ev });

    const checkout = checkouts.start(ev.id, req.session.user.id, ev.priceCents);
    res.status(201).json({ checkout, redirect: `/checkout/${checkout.token}` });
  });

  // GET /api/checkout/:token  -> the checkout summary page's data
  router.get('/checkout/:token', studentOnly, (req, res) => {
    const c = ownCheckout(req);
    if (!c) return res.status(404).json({ error: 'Checkout not found.' });
    res.json({ checkout: c, demoNotice: 'Demo only – no real payment is processed and no card details are collected.' });
  });

  // POST /api/checkout/:token/complete  -> simulated payment approved: issue ONE ticket (US54)
  router.post('/checkout/:token/complete', studentOnly, (req, res) => {
    const c = ownCheckout(req);
    if (!c) return res.status(404).json({ error: 'Checkout not found.' });
    const result = checkouts.complete(c.token, req.session.user.id, now().toISOString(), {
      started: () => hasStarted(c.event),
    });
    if (!result.ok) {
      if (result.reason === 'NOT_FOUND') return res.status(404).json({ error: 'Checkout not found.' });
      return failure(res, result.reason, { ticketCode: result.ticketCode || null, checkout: checkouts.findByToken(c.token) });
    }
    res.status(result.repeat ? 200 : 201).json({
      ticketCode: result.ticketCode,
      repeat: Boolean(result.repeat),
      redirect: `/tickets/${result.ticketCode}?new=1&paid=1`,
    });
  });

  // POST /api/checkout/:token/decline  -> simulate a declined payment (no ticket)
  // POST /api/checkout/:token/cancel   -> the student backs out (no ticket)
  for (const [action, status, message] of [
    ['decline', 'declined', 'The demo payment was declined (simulated). No ticket was issued and nothing was charged.'],
    ['cancel', 'cancelled', 'Checkout cancelled. No ticket was issued and nothing was charged.'],
  ]) {
    router.post(`/checkout/:token/${action}`, studentOnly, (req, res) => {
      const c = ownCheckout(req);
      if (!c) return res.status(404).json({ error: 'Checkout not found.' });
      const r = checkouts.close(c.token, req.session.user.id, status, now().toISOString());
      if (!r.ok) return failure(res, r.checkout && r.checkout.status === 'completed' ? 'ALREADY_REGISTERED' : 'CHECKOUT_CLOSED', { checkout: r.checkout });
      res.json({ checkout: r.checkout, message });
    });
  }

  return router;
}

module.exports = { createCheckoutRoutes };
