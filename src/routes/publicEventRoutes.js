// Attendee-facing event routes (no organizer role needed).
// T21 / US12: retrieve upcoming events   T25 / US15: retrieve one selected event
const express = require('express');
const { localDateString, CATEGORIES } = require('../shared/eventValidation');

const KEYWORD_MAX = 100;

function isRealDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * T85-T89 / US45-US48: read and check the search/filter values from the query string.
 * Returns { filters } or { error } with a message the student can understand.
 */
function readFilters(query) {
  const one = (v) => (Array.isArray(v) ? v[0] : v);
  const q = String(one(query.q) || '').trim().replace(/\s+/g, ' ');
  const category = String(one(query.category) || '').trim();
  const from = String(one(query.from) || '').trim();
  const to = String(one(query.to) || '').trim();

  if (q.length > KEYWORD_MAX) return { error: `Keep your search to ${KEYWORD_MAX} characters or fewer.` };
  if (category && !CATEGORIES.some((c) => c.value === category)) return { error: 'Choose a category from the list.' };
  if (from && !isRealDate(from)) return { error: 'The "from" date is not a real date.' };
  if (to && !isRealDate(to)) return { error: 'The "to" date is not a real date.' };
  if (from && to && from > to) return { error: 'The "from" date must be on or before the "to" date.' };
  return { filters: { q, category, from, to } };
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function createPublicEventRoutes({ events, now = () => new Date() }) {
  const router = express.Router();

  // GET /api/events?q=&category=&from=&to=  -> upcoming events, soonest first.
  // With no filters this is the full list (US12); with filters it is narrowed (US45-US47).
  router.get('/events', (req, res) => {
    const d = now();
    const today = localDateString(d);
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const { filters, error } = readFilters(req.query);
    if (error) return res.status(400).json({ error });
    const all = events.listUpcoming(today, time);
    const active = Boolean(filters.q || filters.category || filters.from || filters.to);
    const list = active ? events.searchUpcoming(today, time, filters) : all;
    res.json({ events: list, total: all.length, filtered: active, filters, categories: CATEGORIES });
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

module.exports = { createPublicEventRoutes, readFilters };
