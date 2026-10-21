// US23 - Each ticket has a unique identifier (T32, T41)
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { generateTicketCode, isTicketCode } = require('../src/lib/ticketCode');
const { makeTestApp } = require('./helpers');
const { createTicketModel } = require('../src/models/ticketModel');

describe('US23 Unique ticket identifier', () => {
  test('AC1: a ticket code has the ETMS-XXXX-XXXX-XXXX format with no look-alike characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateTicketCode();
      assert.ok(isTicketCode(code), code);
      assert.doesNotMatch(code.slice(5), /[01ILO]/, 'no 0/O or 1/I/L');
    }
  });

  test('AC2: 10,000 generated codes are all different (codes are random, not sequential)', () => {
    const codes = new Set();
    for (let i = 0; i < 10000; i++) codes.add(generateTicketCode());
    assert.equal(codes.size, 10000);
  });

  test('AC2: the database refuses two tickets with the same code', () => {
    const { db } = makeTestApp();
    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get().id;
    const [e1, e2] = db.prepare('SELECT id FROM events ORDER BY id').all().map((r) => r.id);
    db.prepare('INSERT INTO tickets (ticket_code, event_id, student_id) VALUES (?, ?, ?)').run('ETMS-AAAA-BBBB-CCCC', e1, student);
    assert.throws(
      () => db.prepare('INSERT INTO tickets (ticket_code, event_id, student_id) VALUES (?, ?, ?)').run('ETMS-AAAA-BBBB-CCCC', e2, student),
      /UNIQUE/
    );
  });

  test('AC2: if a random code ever repeats, the model retries and still issues a unique code', () => {
    const { db } = makeTestApp();
    const codes = ['ETMS-2222-3333-4444', 'ETMS-2222-3333-4444', 'ETMS-5555-6666-7777'];
    const tickets = createTicketModel(db, { generateCode: () => codes.shift() });
    const student = db.prepare("SELECT id FROM users WHERE role = 'student'").get().id;
    const [e1, e2] = db.prepare('SELECT id FROM events ORDER BY id').all().map((r) => r.id);
    assert.equal(tickets.register(e1, student, 10).ticket.code, 'ETMS-2222-3333-4444');
    assert.equal(tickets.register(e2, student, 10).ticket.code, 'ETMS-5555-6666-7777');
  });

  test('isTicketCode rejects anything that is not a ticket code', () => {
    for (const bad of ['', 'ETMS-AAAA-BBBB', 'etms-aaaa-bbbb-cccc', 'ETMS-AAAA-BBBB-CCC0', "' OR 1=1 --", null, 42]) {
      assert.equal(isTicketCode(bad), false, String(bad));
    }
  });
});
