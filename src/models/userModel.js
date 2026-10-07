// T09: user / account data model.
// Roles: 'student' (attendee) and 'organizer' (club organizer).
const bcrypt = require('bcryptjs');

const ROLES = Object.freeze({ STUDENT: 'student', ORGANIZER: 'organizer' });

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    clubName: row.club_name || null,
  };
}

function createUserModel(db) {
  const insertStmt = db.prepare(
    `INSERT INTO users (name, email, password_hash, role, club_name)
     VALUES (?, ?, ?, ?, ?)`
  );
  const byEmailStmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const byIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');

  return {
    /** Create a user. Password is hashed with bcrypt; plain text is never stored. */
    create({ name, email, password, role, clubName = null }) {
      if (!Object.values(ROLES).includes(role)) {
        throw new Error(`Unknown role: ${role}`);
      }
      const hash = bcrypt.hashSync(password, 10);
      const result = insertStmt.run(name.trim(), email.trim().toLowerCase(), hash, role, clubName);
      return toPublicUser(byIdStmt.get(Number(result.lastInsertRowid)));
    },

    findByEmail(email) {
      if (typeof email !== 'string') return null;
      return byEmailStmt.get(email.trim().toLowerCase()) || null;
    },

    findById(id) {
      return toPublicUser(byIdStmt.get(id));
    },

    /**
     * Check an email + password. Returns the public user on success, otherwise null.
     * Shared by organizer login (US05) and attendee login (US02).
     */
    authenticate(email, password) {
      const row = this.findByEmail(email);
      if (!row || typeof password !== 'string') return null;
      if (!bcrypt.compareSync(password, row.password_hash)) return null;
      return toPublicUser(row);
    },
  };
}

module.exports = { createUserModel, ROLES };
