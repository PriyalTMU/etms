// T32 / T36: ticket (registration) data model.
// US17 register · US18 saved to the student's account · US20 never over capacity
// US22 one ticket per student per event · US23 unique ticket code
const { generateTicketCode } = require('../lib/ticketCode');

const ACTIVE = "status <> 'cancelled'";

function toTicket(row) {
  if (!row) return null;
  const ticket = {
    id: row.id,
    code: row.ticket_code,
    eventId: row.event_id,
    studentId: row.student_id,
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at || null,
  };
  // Event information shown on the ticket (US27)
  if (row.title !== undefined) {
    ticket.event = {
      id: row.event_id,
      title: row.title,
      date: row.event_date,
      time: row.event_time,
      location: row.location,
      clubName: row.club_name || null,
      // Sprint 4 (US41): the whole event may have been cancelled by its organizer
      isCancelled: row.event_status === 'cancelled',
      cancelReason: row.cancel_reason || null,
      paymentType: row.payment_type || 'free',
      priceCents: row.price_cents || 0,
    };
  }
  return ticket;
}

const WITH_EVENT = `
  SELECT t.*, e.title, e.event_date, e.event_time, e.location, u.club_name,
         e.status AS event_status, e.cancel_reason, e.payment_type, e.price_cents
  FROM tickets t
  JOIN events e ON e.id = t.event_id
  JOIN users u ON u.id = e.organizer_id`;

function createTicketModel(db, { generateCode = generateTicketCode } = {}) {
  const countActiveStmt = db.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE event_id = ? AND ${ACTIVE}`);
  const activeForStudentStmt = db.prepare(
    `SELECT * FROM tickets WHERE event_id = ? AND student_id = ? AND ${ACTIVE}`
  );
  const insertStmt = db.prepare('INSERT INTO tickets (ticket_code, event_id, student_id) VALUES (?, ?, ?)');
  const byIdStmt = db.prepare(`${WITH_EVENT} WHERE t.id = ?`);
  const byCodeStmt = db.prepare(`${WITH_EVENT} WHERE t.ticket_code = ?`);
  // US42: a student cancels their own active ticket. "AND status = 'active'" makes it happen once only.
  const cancelStmt = db.prepare(
    "UPDATE tickets SET status = 'cancelled', cancelled_at = ? WHERE id = ? AND student_id = ? AND status = 'active'"
  );
  const rawByCodeStmt = db.prepare('SELECT * FROM tickets WHERE ticket_code = ?');
  const hasCheckinStmt = db.prepare('SELECT 1 FROM checkins WHERE ticket_id = ?');
  const byStudentStmt = db.prepare(
    `${WITH_EVENT} WHERE t.student_id = ? ORDER BY e.event_date, e.event_time, t.id`
  );

  /** Run fn inside one write transaction, so the capacity check and insert can't be split up. */
  function inTransaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  return {
    /** Number of tickets issued for an event (cancelled tickets don't count). */
    countActive(eventId) {
      return countActiveStmt.get(eventId).n;
    },

    /** The student's current ticket for an event, or null. */
    findActiveFor(eventId, studentId) {
      return toTicket(activeForStudentStmt.get(eventId, studentId));
    },

    findByCode(code) {
      return toTicket(byCodeStmt.get(code));
    },

    /** All of a student's tickets with their event information, soonest event first (US26). */
    listByStudent(studentId) {
      return byStudentStmt.all(studentId).map(toTicket);
    },

    /**
     * Register a student for an event (US17).
     * Returns { ok: true, ticket } or { ok: false, reason: 'FULL' | 'DUPLICATE', ticket? }.
     * The duplicate check, capacity check and insert run in one transaction (US20, US22).
     */
    register(eventId, studentId, capacity) {
      return inTransaction(() => this.registerInTransaction(eventId, studentId, capacity));
    },

    /** Runs a function in one write transaction (shared with the demo checkout, US54). */
    inTransaction,

    /** register() without its own transaction: call it inside inTransaction(). */

    registerInTransaction(eventId, studentId, capacity) {
      const existing = activeForStudentStmt.get(eventId, studentId);
      if (existing) return { ok: false, reason: 'DUPLICATE', ticket: toTicket(existing) };

      if (countActiveStmt.get(eventId).n >= capacity) return { ok: false, reason: 'FULL' };

      // A repeated random code is astronomically unlikely, but retry instead of failing.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const result = insertStmt.run(generateCode(), eventId, studentId);
          return { ok: true, ticket: toTicket(byIdStmt.get(Number(result.lastInsertRowid))) };
        } catch (err) {
          const msg = String(err.message);
          if (/UNIQUE/i.test(msg) && /ticket_code/.test(msg)) continue;
          if (/UNIQUE/i.test(msg)) return { ok: false, reason: 'DUPLICATE' };
          throw err;
        }
      }
      throw new Error('Could not create a unique ticket code.');
    },

    /**
     * US42 / US43: cancel a student's own ticket. Returns { ok: true, ticket } or
     * { ok: false, reason: 'NOT_FOUND' | 'ALREADY_CANCELLED' | 'ALREADY_USED' }.
     * Runs in one transaction with the check-in tables, so a ticket being scanned at the door
     * can't be cancelled at the same moment, and a double-click cancels only once.
     * Cancelled tickets stop counting towards capacity, which frees the spot (US43).
     */
    cancel(code, studentId, nowIso = new Date().toISOString()) {
      return inTransaction(() => {
        const t = rawByCodeStmt.get(code);
        if (!t || t.student_id !== studentId) return { ok: false, reason: 'NOT_FOUND' };
        if (t.status === 'cancelled') return { ok: false, reason: 'ALREADY_CANCELLED', ticket: toTicket(byIdStmt.get(t.id)) };
        if (t.status === 'checked_in' || hasCheckinStmt.get(t.id)) return { ok: false, reason: 'ALREADY_USED' };
        const changed = cancelStmt.run(nowIso, t.id, studentId).changes;
        if (changed !== 1) return { ok: false, reason: 'ALREADY_CANCELLED' };
        return { ok: true, ticket: toTicket(byIdStmt.get(t.id)) };
      });
    },
  };
}

module.exports = { createTicketModel };
