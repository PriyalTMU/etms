// Sprint 3: event check-in data model.
// T54 / T55 / US29: volunteer assignments   US30 / US31: who may check in for an event
// T60 / T63-T65 / US32-US36: validate a scanned ticket and record the check-in

const RESULT = Object.freeze({
  VALID: 'VALID',
  INVALID: 'INVALID', // no ticket with that code
  WRONG_EVENT: 'WRONG_EVENT', // real ticket, but for another event
  ALREADY_USED: 'ALREADY_USED', // ticket was already checked in
  CANCELLED: 'CANCELLED', // ticket was cancelled (Sprint 4 feature, handled here already)
});

function createCheckinModel(db) {
  const assignStmt = db.prepare('INSERT INTO checkin_assignments (event_id, volunteer_id, assigned_by) VALUES (?, ?, ?)');
  const isAssignedStmt = db.prepare('SELECT 1 FROM checkin_assignments WHERE event_id = ? AND volunteer_id = ?');
  const volunteersStmt = db.prepare(
    `SELECT u.id, u.name, u.email, a.created_at AS assigned_at
     FROM checkin_assignments a JOIN users u ON u.id = a.volunteer_id
     WHERE a.event_id = ? ORDER BY a.created_at, a.id`
  );
  const volunteerEventsStmt = db.prepare(
    `SELECT e.*, u.club_name FROM checkin_assignments a
     JOIN events e ON e.id = a.event_id JOIN users u ON u.id = e.organizer_id
     WHERE a.volunteer_id = ? ORDER BY e.event_date, e.event_time, e.id`
  );
  const ticketByCodeStmt = db.prepare(
    `SELECT t.*, s.name AS holder_name, e.title AS event_title, e.event_date, e.event_time
     FROM tickets t JOIN users s ON s.id = t.student_id JOIN events e ON e.id = t.event_id
     WHERE t.ticket_code = ?`
  );
  const checkinForTicketStmt = db.prepare(
    `SELECT c.*, v.name AS checked_in_by_name FROM checkins c JOIN users v ON v.id = c.checked_in_by WHERE c.ticket_id = ?`
  );
  const insertCheckinStmt = db.prepare('INSERT INTO checkins (ticket_id, event_id, checked_in_by, checked_in_at) VALUES (?, ?, ?, ?)');
  const markCheckedInStmt = db.prepare("UPDATE tickets SET status = 'checked_in' WHERE id = ? AND status = 'active'");
  const statsStmt = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM tickets WHERE event_id = ? AND status <> 'cancelled') AS issued,
       (SELECT COUNT(*) FROM checkins WHERE event_id = ?) AS checked_in`
  );

  function inTransaction(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  return {
    RESULT,

    /** US29: give a volunteer check-in access to one event. Returns false if already assigned. */
    assign(eventId, volunteerId, assignedBy) {
      try {
        assignStmt.run(eventId, volunteerId, assignedBy);
        return true;
      } catch (err) {
        if (/UNIQUE/i.test(String(err.message))) return false;
        throw err;
      }
    },

    isAssigned(eventId, userId) {
      return !!isAssignedStmt.get(eventId, userId);
    },

    listVolunteers(eventId) {
      return volunteersStmt.all(eventId).map((r) => ({ id: r.id, name: r.name, email: r.email, assignedAt: r.assigned_at }));
    },

    /** Events a volunteer has been given check-in access to (US30). */
    eventsForVolunteer(userId) {
      return volunteerEventsStmt.all(userId).map((r) => ({
        id: r.id, title: r.title, date: r.event_date, time: r.event_time, location: r.location, clubName: r.club_name,
      }));
    },

    /** Issued tickets and how many have been checked in (US38). */
    stats(eventId) {
      const s = statsStmt.get(eventId, eventId);
      return { issued: s.issued, checkedIn: s.checked_in, notCheckedIn: Math.max(0, s.issued - s.checked_in) };
    },

    /**
     * US32-US36: check a ticket code against the event being managed and, if it is valid,
     * record the check-in. The lookup, the checks and the update run in one transaction,
     * so two volunteers scanning the same ticket at the same moment can't both admit it.
     */
    scan(eventId, code, volunteerId, nowIso) {
      return inTransaction(() => {
        const t = ticketByCodeStmt.get(code);
        if (!t) return { result: RESULT.INVALID };

        const ticket = { code: t.ticket_code, holderName: t.holder_name, eventId: t.event_id, eventTitle: t.event_title };
        if (t.event_id !== eventId) return { result: RESULT.WRONG_EVENT, ticket };
        if (t.status === 'cancelled') return { result: RESULT.CANCELLED, ticket };

        const previous = checkinForTicketStmt.get(t.id);
        if (previous || t.status === 'checked_in') {
          return {
            result: RESULT.ALREADY_USED,
            ticket,
            checkedInAt: previous ? previous.checked_in_at : null,
            checkedInBy: previous ? previous.checked_in_by_name : null,
          };
        }

        insertCheckinStmt.run(t.id, eventId, volunteerId, nowIso);
        markCheckedInStmt.run(t.id);
        return { result: RESULT.VALID, ticket, checkedInAt: nowIso };
      });
    },

  };
}

module.exports = { createCheckinModel, RESULT };
