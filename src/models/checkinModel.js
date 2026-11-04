// Sprint 3: event check-in data model.
// T54 / T55 / US29: volunteer assignments   US30 / US31: who may check in for an event

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

  };
}

module.exports = { createCheckinModel, RESULT };
