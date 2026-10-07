# Sprint 1 Test Report – ETMS

CPS714 · Section 05 · Team 03 · Report date: **Oct 7, 2026**
Covers tasks **T26** (integration), **T27** (story-level tests), **T28** (end-to-end Sprint test) and **T29** (defect fixing).

## Summary

| Item | Result |
|---|---|
| Committed stories tested | 12 / 12 (US01, US02, US03, US05, US06, US08, US09, US10, US12, US13, US14, US15) |
| Automated checks | **127 run · 127 pass · 0 fail** (`npm test`) |
| End-to-end Sprint flow | **Pass** – automated (API) and manual (browser) |
| Defects found during integration | 6 found · 6 fixed · regression tests added |
| Known blocking defects | **None** |

## How to re-run

```bash
cd etms
npm install
npm test          # all 127 checks, uses an in-memory database (your data is not touched)
```

Environment used: Node.js 22.23 (macOS + Linux), Chromium (latest) for browser checks, desktop 1100 px and phone 390 px widths.

## T27 – Story-level tests

Every acceptance criterion has at least one automated test (test names start with `AC1`, `AC2`, … so they map to the story cards in the Sprint 1 document).

| Story | Test file | Checks | Result |
|---|---|---|---|
| US01 Create attendee account | `tests/us01-create-account.test.js` | 19 | Pass |
| US02 Student login | `tests/us02-student-login.test.js` | 9 | Pass |
| US03 Invalid student login | `tests/us03-invalid-login.test.js` | 8 | Pass |
| US05 Organizer login | `tests/us05-organizer-login.test.js` | 10 | Pass |
| US06 Organizer-only functions | `tests/us06-organizer-only.test.js` | 7 | Pass |
| US08 Create event | `tests/us08-create-event.test.js` | 6 | Pass |
| US09 Event validation | `tests/us09-event-validation.test.js` | 31 | Pass |
| US10 Save event | `tests/us10-save-event.test.js` | 6 | Pass |
| US12 Upcoming event list | `tests/us12-upcoming-events.test.js` | 7 | Pass |
| US13 Event list information | `tests/us13-event-list-info.test.js` | 5 | Pass |
| US14 Select event | `tests/us14-select-event.test.js` | 6 | Pass |
| US15 Event details | `tests/us15-event-details.test.js` | 4 | Pass |
| End-to-end flow (T28) | `tests/e2e-sprint1-flow.test.js` | 2 | Pass |
| Defect regressions (T29) | `tests/t29-defect-regressions.test.js` | 7 | Pass |
| **Total** | | **127** | **Pass** |

Manual test cases (36) are recorded on the **Testing** sheet of the project tracker, all Pass.

## T26 / T28 – Integration and end-to-end test

The Sprint Goal flow was run as one continuous scenario, both as an automated test and by hand in the browser:

| Step | Story | Result |
|---|---|---|
| Organizer logs in | US05 | Pass |
| Organizer opens event management; students are blocked from it | US06 | Pass |
| Incomplete event is rejected with clear messages | US09 | Pass |
| Valid event "CPS714 Demo Night" is created | US08 | Pass |
| Event is saved and survives a server restart | US10 | Pass |
| New student creates an account (bad input and duplicate email rejected first) | US01 | Pass |
| Wrong password rejected, student stays logged out | US03 | Pass |
| Student logs in and lands on the event list | US02 | Pass |
| New event appears in the upcoming list with title, date/time, location | US12, US13 | Pass |
| Student selects it; another event's data never shows | US14 | Pass |
| Details page shows all fields, matching what the organizer entered | US15 | Pass |

### Non-functional checks

| NFR | Check | Result |
|---|---|---|
| NFR2 Access control | Students get 403 on organizer pages/APIs; logged-out users redirected; organizer pages not cached after logout | Pass |
| NFR3 Privacy | Sign-up stores only name, email, hashed password, role | Pass |
| NFR4 Performance | Event list ~50 ms, create-event form ~60 ms (limit 3 s) | Pass |
| NFR6 Usability | All pages work at 390 px phone width with no sideways scrolling; keyboard can tab to and open events | Pass |
| NFR7 Data integrity | Stored events match submitted values exactly; data kept after restart | Pass |
| Security extra | Passwords hashed with bcrypt; HTML typed into event fields is shown as plain text | Pass |

## T29 – Defects found and fixed

| ID | Defect | Severity | Fix | Regression test |
|---|---|---|---|---|
| D1 | Long unbroken titles/locations overflowed the screen at phone width (list, details, dashboard) | Medium | Text wraps (`overflow-wrap: anywhere`) | `t29 › D1` + browser check |
| D2 | After an organizer logged out, pressing **Back** showed their cached dashboard | High | `Cache-Control: no-store` on organizer pages and all API data; pages restored from back/forward cache reload and re-check login | `t29 › D2` (2 tests) + browser check |
| D3 | Home page didn't show who was logged in | Low | Home page uses the shared header (badge, name, log out) | `t29 › D3` |
| D4 | Organizer couldn't open the student view of their own event | Low | Dashboard cards have "View as students see it →" | `t29 › D4` |
| D5 | Unknown pages showed a plain unstyled "Page not found" | Low | Styled 404 page with links back to events/home | `t29 › D5` |
| D6 | On Node.js older than 22.13 the app crashed with a confusing error | Medium | Version check with a clear "install Node 22.13+" message | `t29 › D6` |

### Known minor items (not blocking, moved to backlog)

- An organizer who is logged in can still open the student sign-up page. Harmless (it can only create a separate student account), but could redirect them in a later sprint.
- Sessions are kept in server memory, so restarting the server logs everyone out. Fine for the course demo; a persistent session store can be added later if needed.
