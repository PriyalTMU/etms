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
    };
  }
  return ticket;
}

const WITH_EVENT = `
  SELECT t.*, e.title, e.event_date, e.event_time, e.location, u.club_name
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
      return inTransaction(() => {
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
      });
    },
  };
}

module.exports = { createTicketModel };
