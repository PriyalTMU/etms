# Sprint 2 Test Report – ETMS (T47–T50)

**Sprint Goal:** students can register for a campus event and receive a ticket with a unique ID and QR code that they can find on a My Tickets page, while registration stops at capacity and duplicate registrations are blocked.

## Summary

| Item | Result |
|---|---|
| Automated checks (`npm test`) | **183 run, 183 pass, 0 fail** (127 from Sprint 1 + 56 new) |
| Sprint 2 stories with tests for every acceptance criterion | 12 of 12 (US17–US28) |
| End-to-end Sprint 2 flow (automated + browser, desktop 1280 px and phone 390 px) | Pass |
| QR code read back from the rendered ticket page with a QR decoder | Pass – decodes to the exact ticket code (desktop and phone) |
| Sprint 1 regression | Pass – all 127 Sprint 1 checks still pass; Sprint 1 flow re-run |
| Defects found / fixed | 3 found, 3 fixed (D7–D9) |
| Known blocking defects | None |

## Automated tests per story

| Story | Test file | Checks |
|---|---|---|
| US17 Register for an event | `tests/us17-register-event.test.js` | 7 |
| US18 Registration saved to account | `tests/us18-registration-saved.test.js` | 4 |
| US19 Ticket availability updates | `tests/us19-ticket-availability.test.js` | 5 |
| US20 Stop at capacity · US21 Reject when full | `tests/us20-us21-capacity.test.js` | 6 |
| US22 No duplicate registrations | `tests/us22-duplicate-registration.test.js` | 5 |
| US23 Unique ticket identifier | `tests/us23-ticket-code.test.js` | 5 |
| US24 QR code on ticket | `tests/us24-ticket-qr.test.js` | 4 |
| US25 View QR e-ticket | `tests/us25-view-qr-ticket.test.js` | 4 |
| US26 My Tickets page | `tests/us26-my-tickets.test.js` | 5 |
| US27 Ticket shows event info | `tests/us27-ticket-event-info.test.js` | 3 |
| US28 Open a ticket | `tests/us28-open-ticket.test.js` | 3 |
| End-to-end Sprint 2 flow + Sprint 1 regression | `tests/e2e-sprint2-flow.test.js` | 2 |
| Defect regressions D7–D9 | `tests/t50-sprint2-defect-regressions.test.js` | 3 |
| **Total new in Sprint 2** | | **56** |

## Key checks

- **Capacity under load (US20):** 12 students register at the same moment for a 5-spot event → exactly 5 tickets, 7 "event full" replies, 5 rows in the database. A 1-spot event raced by two students gives one 201 and one 409.
- **Duplicates (US22):** the same student sending three registrations at once ends up with one ticket. The database has a unique index on (event, student) for active tickets.
- **Ticket codes (US23):** 10,000 generated codes are all different; the database refuses a repeated code; the model retries if a random code ever repeats.
- **Privacy / access:** students can only open their own tickets (others get "Ticket not found."); organizers get 403; logged-out users are sent to login and returned afterwards. The QR code holds only the ticket code.
- **Persistence (US18):** tickets are still on the account after logging out and back in, and after a server restart.

## Mid-sprint integration check (T47)

Following our Sprint 1 retrospective, registration (Priyal), the ticket model and availability (Ravi) and the ticket pages (Aneesa) were connected and run together mid-sprint instead of at the end. The full flow ran in the browser at desktop and phone width.

## Defects found and fixed (T50)

| ID | Defect | Severity | Fix |
|---|---|---|---|
| D7 | On My Tickets, the ticket code ran straight into "Open ticket →" with no space | Low | Spacing after the ticket code |
| D8 | On the desktop ticket page the QR code sat off-centre with the ticket code squeezed beside it | Medium | QR image and code each on their own centred line |
| D9 | The disabled "Event full" button showed the "busy" (wait) cursor, as if something was loading | Low | Not-allowed cursor and a clearly faded button for full events |

Each fix has a regression check in `tests/t50-sprint2-defect-regressions.test.js`, and the browser flow was re-run after the fixes.

## Known limitations (not blocking)

- Sessions are still kept in server memory (from Sprint 1), so users are logged out if the server restarts. Their tickets are kept.
- Ticket cancellation and check-in use the `status` column added this sprint, but those stories are planned for Sprints 3 and 4.
