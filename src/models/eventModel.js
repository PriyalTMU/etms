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
    ...(row.club_name !== undefined ? { clubName: row.club_name } : {}),
  };
}

function createEventModel(db) {
  const insertStmt = db.prepare(
    `INSERT INTO events (organizer_id, title, description, event_date, event_time, location, capacity)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const byIdStmt = db.prepare(
    `SELECT e.*, u.club_name FROM events e JOIN users u ON u.id = e.organizer_id WHERE e.id = ?`
  );
  const byOrganizerStmt = db.prepare(
    `SELECT * FROM events WHERE organizer_id = ? ORDER BY event_date, event_time`
  );
  const upcomingStmt = db.prepare(
    `SELECT e.*, u.club_name FROM events e JOIN users u ON u.id = e.organizer_id
     WHERE e.event_date >= ? ORDER BY e.event_date, e.event_time`
  );

  return {
    /** Insert an already-validated event. Returns the stored event. */
    create(organizerId, { title, description, date, time, location, capacity }) {
      const result = insertStmt.run(organizerId, title, description, date, time, location, capacity);
      return this.findById(Number(result.lastInsertRowid));
    },

    findById(id) {
      return toEvent(byIdStmt.get(id));
    },

    listByOrganizer(organizerId) {
      return byOrganizerStmt.all(organizerId).map(toEvent);
    },

    /** Events on or after the given date (YYYY-MM-DD). For the attendee event list (US12). */
    listUpcoming(fromDate) {
      return upcomingStmt.all(fromDate).map(toEvent);
    },
  };
}

module.exports = { createEventModel };
