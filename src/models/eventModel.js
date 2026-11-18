// T10: event data model.
// Fields from FR5: title, description, date, time, location, maximum capacity.

function toEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    description: row.description,
    date: row.event_date,
    time: row.event_time,
    location: row.location,
    capacity: row.capacity,
    createdAt: row.created_at,
    // Sprint 4
    category: row.category || 'other',
    paymentType: row.payment_type || 'free',
    priceCents: row.price_cents || 0,
    status: row.status || 'scheduled',
    isCancelled: row.status === 'cancelled',
    cancelledAt: row.cancelled_at || null,
    cancelReason: row.cancel_reason || null,
    updatedAt: row.updated_at || null,
    ...(row.club_name !== undefined ? { clubName: row.club_name } : {}),
    // US19: live ticket availability (cancelled tickets don't count)
    ...(row.tickets_issued !== undefined
      ? {
          ticketsIssued: row.tickets_issued,
          ticketsRemaining: Math.max(0, row.capacity - row.tickets_issued),
          isFull: row.tickets_issued >= row.capacity,
        }
      : {}),
  };
}

// T37 / US19: number of tickets issued so far, added to every event query.
const ISSUED = `(SELECT COUNT(*) FROM tickets t WHERE t.event_id = e.id AND t.status <> 'cancelled') AS tickets_issued`;

function createEventModel(db) {
  const insertStmt = db.prepare(
    `INSERT INTO events (organizer_id, title, description, event_date, event_time, location, capacity,
                         category, payment_type, price_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  // US39: only the event's own organizer, and only while it is not cancelled
  const updateStmt = db.prepare(
    `UPDATE events SET title = ?, description = ?, event_date = ?, event_time = ?, location = ?, capacity = ?,
            category = ?, payment_type = ?, price_cents = ?, updated_at = ?
     WHERE id = ? AND organizer_id = ? AND status = 'scheduled'`
  );
  // US41: mark as cancelled (kept, never deleted). Runs once: a second cancel changes nothing.
  const cancelStmt = db.prepare(
    `UPDATE events SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, updated_at = ?
     WHERE id = ? AND organizer_id = ? AND status = 'scheduled'`
  );
  const byIdStmt = db.prepare(
    `SELECT e.*, u.club_name, ${ISSUED} FROM events e JOIN users u ON u.id = e.organizer_id WHERE e.id = ?`
  );
  const byOrganizerStmt = db.prepare(
    `SELECT e.*, ${ISSUED} FROM events e WHERE e.organizer_id = ? ORDER BY e.event_date, e.event_time`
  );
  // Upcoming = a later date, or today with a start time that has not passed yet.
  const upcomingStmt = db.prepare(
    `SELECT e.*, u.club_name, ${ISSUED} FROM events e JOIN users u ON u.id = e.organizer_id
     WHERE e.event_date > ? OR (e.event_date = ? AND e.event_time > ?)
     ORDER BY e.event_date, e.event_time, e.id`
  );

  return {
    /** Insert an already-validated event. Returns the stored event. */
    create(organizerId, { title, description, date, time, location, capacity, category = 'other', paymentType = 'free', priceCents = 0 }) {
      const result = insertStmt.run(organizerId, title, description, date, time, location, capacity,
        category, paymentType, paymentType === 'demo_paid' ? priceCents : 0);
      return this.findById(Number(result.lastInsertRowid));
    },

    /** US39: save validated changes. Returns the updated event, or null if nothing was changed. */
    update(eventId, organizerId, v, nowIso = new Date().toISOString()) {
      const r = updateStmt.run(v.title, v.description, v.date, v.time, v.location, v.capacity,
        v.category, v.paymentType, v.paymentType === 'demo_paid' ? v.priceCents : 0, nowIso, eventId, organizerId);
      return r.changes === 1 ? this.findById(eventId) : null;
    },

    /** US41: cancel an event. Returns true only for the call that actually cancelled it. */
    cancel(eventId, organizerId, reason, nowIso = new Date().toISOString()) {
      return cancelStmt.run(nowIso, reason || null, nowIso, eventId, organizerId).changes === 1;
    },

    findById(id) {
      return toEvent(byIdStmt.get(id));
    },

    listByOrganizer(organizerId) {
      return byOrganizerStmt.all(organizerId).map(toEvent);
    },

    /**
     * T21 / US12: upcoming events, soonest first.
     * @param {string} today YYYY-MM-DD
     * @param {string} [nowTime] HH:MM - events today at or before this time are left out
     */
    listUpcoming(today, nowTime = '00:00') {
      return upcomingStmt.all(today, today, nowTime).map(toEvent);
    },

    /**
     * US45-US48: upcoming events narrowed by keyword, category and date range.
     * Every value is passed as a bound parameter (never pasted into the SQL).
     * @param {{q?: string, category?: string, from?: string, to?: string}} f
     */
    searchUpcoming(today, nowTime, f = {}) {
      const where = ['(e.event_date > ? OR (e.event_date = ? AND e.event_time > ?))'];
      const params = [today, today, nowTime];
      if (f.q) {
        // Every word must appear somewhere: title, description, location or club name.
        for (const word of f.q.split(/\s+/).filter(Boolean)) {
          const like = '%' + word.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
          where.push(`(e.title LIKE ? ESCAPE '\\' OR e.description LIKE ? ESCAPE '\\'
                      OR e.location LIKE ? ESCAPE '\\' OR u.club_name LIKE ? ESCAPE '\\')`);
          params.push(like, like, like, like);
        }
      }
      if (f.category) { where.push('e.category = ?'); params.push(f.category); }
      if (f.from) { where.push('e.event_date >= ?'); params.push(f.from); }
      if (f.to) { where.push('e.event_date <= ?'); params.push(f.to); }
      const sql = `SELECT e.*, u.club_name, ${ISSUED} FROM events e JOIN users u ON u.id = e.organizer_id
                   WHERE ${where.join(' AND ')} ORDER BY e.event_date, e.event_time, e.id`;
      return db.prepare(sql).all(...params).map(toEvent);
    },
  };
}

module.exports = { createEventModel };
