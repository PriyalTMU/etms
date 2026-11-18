# Sprint 4 Test Report – ETMS (T96–T100)

**Sprint Goal:** organizers can edit or cancel events, students can cancel tickets and search/filter events, and the system demonstrates a basic free/demo-paid registration flow while keeping all previous Sprint functionality working.

## Summary

| Item | Result |
|---|---|
| Automated checks (`npm test`) | **307 run, 307 pass, 0 fail** (229 from Sprints 1–3 + 78 new) |
| Sprint 4 stories with tests for every acceptance criterion | 16 of 16 (US39–US54) |
| Story points delivered | 28 of 28 |
| Repeated-action tests (T96) | 7 checks – double clicks, repeat submits, repeat cancels, register/cancel loops |
| End-to-end Sprint 4 flow (automated, with server restart) | Pass |
| Sprint 3 database upgraded in place (no reset needed) | Pass |
| Browser run at desktop (1200 px) and phone (390 px) width | Pass – no JavaScript errors, no sideways scrolling |
| Sprint 1–3 regression | Pass – all 229 earlier checks still pass; check-in re-run in the E2E test |
| Defects found / fixed | 3 found, 3 fixed (D13–D15) |
| Known blocking defects | None |

## Automated tests per story

| Story | Test file | Checks |
|---|---|---|
| US39 Edit an existing event | `tests/us39-edit-event.test.js` | 8 |
| US40 Event changes appear to students | `tests/us40-changes-visible.test.js` | 3 |
| US41 Cancel an event | `tests/us41-cancel-event.test.js` | 7 |
| US42 Cancel an active ticket · US43 Restore availability | `tests/us42-us43-cancel-ticket.test.js` | 9 |
| US44 Cancellation confirmation | `tests/us44-cancellation-confirmation.test.js` | 3 |
| US45 Search by keyword | `tests/us45-search.test.js` | 5 |
| US46 Category · US47 Date · US48 Clear filters | `tests/us46-us47-us48-filters.test.js` | 7 |
| US49 Registration confirmation · US50 Failure reasons | `tests/us49-us50-registration-messages.test.js` | 4 |
| US51 Free/demo-paid · US52 Status shown to students | `tests/us51-us52-payment-type.test.js` | 8 |
| US53 Simulated checkout · US54 Ticket after checkout | `tests/us53-us54-demo-checkout.test.js` | 12 |
| Repeated actions (T96) | `tests/t96-repeated-actions.test.js` | 7 |
| End-to-end Sprint 4 flow + Sprint 3 database upgrade (T99) | `tests/e2e-sprint4-flow.test.js` | 2 |
| Defect regressions D13–D15 (T100) | `tests/t100-sprint4-defect-regressions.test.js` | 3 |
| **Total new in Sprint 4** | | **78** |

## Key checks

- **Edit / cancel (US39–US41):** only the event's own organizer can edit or cancel (others get "not found", students 403, logged-out 401). Edits use the same validation as creating; capacity can't go below tickets already issued. A cancelled event is kept and marked, never deleted; it can't be edited or registered for, and check-in refuses its tickets (`EVENT_CANCELLED`).
- **Changes reach students (US40):** list, details, the student's ticket and My Tickets all show the new values straight away; event data is sent with `Cache-Control: no-store`, so a refresh never shows old information.
- **Ticket cancellation (US42–US44):** students can cancel only their own active tickets before the event. Checked-in tickets and tickets for events that have started are refused with a clear reason. The spot goes back immediately (US43) and another student can take it; availability can never go above capacity. Cancellation survives a server restart.
- **Search and filters (US45–US48):** keyword search covers title, description, location and club; every word must match; case does not matter. `%`, `_`, quotes and SQL text are matched literally (bound parameters, escaped LIKE). Category and date filters combine with each other and with search; invalid or reversed dates and unknown categories get a clear message. Clear returns the full list and resets the controls; the search is kept in the address bar.
- **Registration messages (US49, US50):** success names the event and links to the new ticket. Full, duplicate, cancelled, demo-paid, logged-out, organizer and unknown-event cases each give their own reason, and none creates a ticket.
- **Free / demo-paid (US51, US52):** organizers choose Free or Demo-paid (price $0.50–$500.00) when creating or editing; unknown types and bad prices are rejected; older clients that send no type get Free. Students see the type on the list and details. Free events register normally; demo-paid events go to checkout.
- **Simulated checkout (US53, US54):** the page states clearly that no real payment is processed and has no card fields; the `checkouts` table has no card columns (NFR1). Complete, decline (simulated) and cancel all work; declined/cancelled/failed checkouts never issue a ticket. Five simultaneous "complete" requests produce exactly one ticket. If the event fills up or is cancelled during checkout, nothing is issued and the reason is shown. The ticket has the usual unique code and QR code and appears in My Tickets.
- **Speed (NFR4):** event list, search, filters and details respond in about 1–2 ms on the local server.

## Mid-sprint integration check (T97)

The organizer side (edit/cancel/payment type), the student side (ticket cancellation, registration messages) and search/checkout were connected and run together as one flow. The checks are in `tests/e2e-sprint4-flow.test.js`: create → edit into a demo-paid event → student finds it by keyword + category + date → declined payment issues nothing → completed payment issues one ticket → another student fills the last spot → a third is told it's full → first student cancels → spot restored → third student gets it → volunteer checks them in → cancelled ticket refused at the door → organizer cancels a free event → registration stops.

## Defects found and fixed (T100)

| ID | Defect | Severity | Fix |
|---|---|---|---|
| D13 | Refreshing or sharing a link such as `/events?category=career` lost the category filter and showed every event | Medium | The category list is built from the shared list before the first search, so the value in the address bar is kept |
| D14 | On phones the search/filter panel filled almost the whole first screen | Low | Category on its own row, the two dates side by side, tighter spacing |
| D15 | A cancelled event still offered "Open check-in" and the volunteer form to its organizer | Low | Both are hidden once the event is cancelled (check-in was already refused by the server) |

## Risk review (Sprint 4 risks)

| ID | Risk | What happened | Status |
|---|---|---|---|
| R16 | Edits/cancellations cause inconsistent student/ticket data | Edits show everywhere straight away; cancelled events block registration, checkout and check-in; tested in the E2E flow | Resolved |
| R17 | Ticket cancellation incorrectly changes capacity | Cancel runs once in a transaction; double/triple clicks and register/cancel loops keep counts right | Resolved |
| R18 | Search/filter combinations give wrong results | Each filter tested alone and combined, plus clear/reset; D13 found and fixed | Resolved |
| R19 | Simulated checkout creates duplicate tickets | Checkout completes once in a transaction; 5 simultaneous completes = 1 ticket | Resolved |
| R20 | Sprint 4 breaks earlier functionality | All 229 Sprint 1–3 checks pass; a Sprint 3 database upgrades in place | Resolved |

## Screenshots

`docs/screenshots/sprint4/` – organizer create/edit/cancel, search and filters, demo checkout, ticket cancellation, cancelled event views, and phone-width versions.
