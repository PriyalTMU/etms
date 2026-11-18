// Sprint 4 - T94 / US53: simulated (demo) checkout · T95 / US54: ticket issued after a successful checkout
// No card details are ever asked for or stored (NFR1). A checkout is just a record that a student
// started paying for a demo-paid event, and what happened: completed, declined (simulated) or cancelled.
const crypto = require('node:crypto');

function toCheckout(row) {
  if (!row) return null;
  return {
    token: row.token,
    eventId: row.event_id,
    studentId: row.student_id,
    amountCents: row.amount_cents,
    status: row.status,
    failure: row.failure || null,
    ticketCode: row.ticket_code || null,
    createdAt: row.created_at,
    finishedAt: row.finished_at || null,
    event: row.title === undefined ? undefined : {
      id: row.event_id,
      title: row.title,
      date: row.event_date,
      time: row.event_time,
      location: row.location,
      clubName: row.club_name || null,
      isCancelled: row.event_status === 'cancelled',
    },
  };
}

function createCheckoutModel(db, tickets) {
  const WITH_EVENT = `
    SELECT c.*, e.title, e.event_date, e.event_time, e.location, e.status AS event_status, u.club_name,
           t.ticket_code
    FROM checkouts c
    JOIN events e ON e.id = c.event_id
    JOIN users u ON u.id = e.organizer_id
    LEFT JOIN tickets t ON t.id = c.ticket_id`;
  const byTokenStmt = db.prepare(`${WITH_EVENT} WHERE c.token = ?`);
  const pendingStmt = db.prepare(
    "SELECT token FROM checkouts WHERE event_id = ? AND student_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
  );
  const insertStmt = db.prepare('INSERT INTO checkouts (token, event_id, student_id, amount_cents) VALUES (?, ?, ?, ?)');
  const eventStmt = db.prepare('SELECT capacity, status, payment_type FROM events WHERE id = ?');
  const finishStmt = db.prepare(
    "UPDATE checkouts SET status = ?, failure = ?, ticket_id = ?, finished_at = ? WHERE token = ? AND status = 'pending'"
  );

  return {
    findByToken(token) {
      return toCheckout(byTokenStmt.get(token));
    },

    /**
     * Start a checkout, or reuse the student's open one for this event,
     * so clicking "Continue to demo checkout" twice doesn't create two.
     */
    start(eventId, studentId, amountCents) {
      const open = pendingStmt.get(eventId, studentId);
      if (open) return this.findByToken(open.token);
      const token = crypto.randomBytes(16).toString('base64url');
      insertStmt.run(token, eventId, studentId, amountCents);
      return this.findByToken(token);
    },

    /**
     * US53 / US54: finish a checkout with the simulated payment approved.
     * Everything runs in ONE transaction: the event is re-checked, the ticket is created with the
     * normal capacity/duplicate rules, and the checkout is marked completed. A checkout that is
     * already completed returns its existing ticket, so a repeated submission never makes a second one.
     * Returns { ok: true, ticketCode, repeat? } or { ok: false, reason }.
     */
    complete(token, studentId, nowIso, { started }) {
      return tickets.inTransaction(() => {
        const c = byTokenStmt.get(token);
        if (!c || c.student_id !== studentId) return { ok: false, reason: 'NOT_FOUND' };
        if (c.status === 'completed') return { ok: true, ticketCode: c.ticket_code, repeat: true };
        if (c.status !== 'pending') return { ok: false, reason: 'CHECKOUT_CLOSED', status: c.status };

        const ev = eventStmt.get(c.event_id);
        const fail = (reason) => {
          finishStmt.run('failed', reason, null, nowIso, token);
          return { ok: false, reason };
        };
        if (!ev || ev.status === 'cancelled') return fail('EVENT_CANCELLED');
        if (started(c)) return fail('EVENT_STARTED');
        if (ev.payment_type !== 'demo_paid') return fail('NOT_PAID');

        const result = tickets.registerInTransaction(c.event_id, studentId, ev.capacity);
        if (!result.ok) {
          const reason = result.reason === 'FULL' ? 'EVENT_FULL' : 'ALREADY_REGISTERED';
          finishStmt.run('failed', reason, null, nowIso, token);
          return { ok: false, reason, ticketCode: result.ticket ? result.ticket.code : null };
        }
        finishStmt.run('completed', null, result.ticket.id, nowIso, token);
        return { ok: true, ticketCode: result.ticket.code };
      });
    },

    /** The student cancels the checkout, or the simulated payment is declined. No ticket is issued. */
    close(token, studentId, status, nowIso) {
      const c = byTokenStmt.get(token);
      if (!c || c.student_id !== studentId) return { ok: false, reason: 'NOT_FOUND' };
      const changed = finishStmt.run(status, status === 'declined' ? 'DECLINED' : null, null, nowIso, token).changes;
      return { ok: changed === 1, checkout: this.findByToken(token) };
    },
  };
}

module.exports = { createCheckoutModel };
