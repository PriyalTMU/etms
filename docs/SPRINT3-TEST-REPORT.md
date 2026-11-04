# Sprint 3 Test Report – ETMS (T68–T72)

**Sprint Goal:** authorized volunteers can access check-in for an assigned event, verify attendee tickets, reject invalid or already-used tickets, mark valid tickets as checked in, and organizers can monitor issued tickets and attendance.

## Summary

| Item | Result |
|---|---|
| Automated checks (`npm test`) | **229 run, 229 pass, 0 fail** (183 from Sprints 1–2 + 46 new) |
| Sprint 3 stories with tests for every acceptance criterion | 10 of 10 (US29–US38) |
| End-to-end Sprint 3 flow (automated, with server restart) | Pass |
| Browser run at desktop (1280 px) and phone (390 px) width | Pass – typed code, photo of QR code and live camera all check tickets in |
| Live camera scanning | Pass in Chromium with a simulated camera showing a real ticket QR code (desktop and phone width) |
| Phone over Wi-Fi (plain http) | Camera button replaced by "Take a photo of the QR code" + explanation, as designed |
| Sprint 1–2 regression | Pass – all 183 earlier checks still pass; registration flow re-run |
| Defects found / fixed | 3 found, 3 fixed (D10–D12) |
| Known blocking defects | None |

## Automated tests per story

| Story | Test file | Checks |
|---|---|---|
| US29 Give volunteer check-in access | `tests/us29-volunteer-access.test.js` | 6 |
| US30 Volunteer accesses assigned check-in | `tests/us30-volunteer-checkin-page.test.js` | 4 |
| US31 Block unauthorized check-in | `tests/us31-block-unauthorized-checkin.test.js` | 4 |
| US32 Enter or scan ticket identifier | `tests/us32-enter-scan-ticket.test.js` | 6 |
| US33 Valid result · US34 Reject invalid | `tests/us33-us34-checkin-results.test.js` | 6 |
| US35 Reject already-used ticket | `tests/us35-already-used.test.js` | 4 |
| US36 Mark valid ticket checked in | `tests/us36-mark-checked-in.test.js` | 5 |
| US37 Issued tickets · US38 Checked-in attendees | `tests/us37-us38-attendance.test.js` | 6 |
| End-to-end Sprint 3 flow + regression | `tests/e2e-sprint3-flow.test.js` | 2 |
| Defect regressions D10–D12 | `tests/t72-sprint3-defect-regressions.test.js` | 3 |
| **Total new in Sprint 3** | | **46** |

## Key checks

- **Access (US29–US31):** volunteer access is per event; volunteers can't open other events; plain students, other organizers and logged-out users are refused. Organizers can't add volunteers to another club's event.
- **Scan results (US32–US35):** VALID, INVALID (unknown code), WRONG_EVENT (ticket for another event), ALREADY_USED, CANCELLED and UNREADABLE (junk input such as SQL text, numbers, 5,000-character strings). Junk input never touches the database.
- **One check-in per ticket (US35, US36):** repeated scans and two people scanning the same ticket at the same moment create exactly one check-in record (UNIQUE ticket_id in a transaction).
- **Persistence (US36):** check-ins survive a server restart; the student's own ticket shows "Checked in".
- **Attendance (US37, US38):** only the organizer's own event; summary updates after each check-in; no student emails are sent to the page.
- **Speed:** check-in page, scan and attendance requests take about 2–6 ms on the local server.

## Mid-sprint integration check (T68)

Volunteer access (Priyal), ticket validation and check-in (Ravi) and the result screens (Aneesa) were connected on Oct 30 with time set aside for it, using the check-in replies agreed at Sprint Planning (VALID, INVALID, WRONG_EVENT, ALREADY_USED).

## Defects found and fixed (T72)

| ID | Defect | Severity | Fix |
|---|---|---|---|
| D10 | With the camera still pointed at a ticket the volunteer had just let in, the page re-scanned it 3 s later and flipped to "ALREADY USED – DO NOT LET IN" for the same person | High | The camera ignores a code it already sent for 60 s; typed codes still always go through |
| D11 | The ticket-code box's placeholder was cut off at phone width | Low | Short placeholder plus a format hint under the box |
| D12 | The attendance table was too cramped on phones | Low | Registered column hidden under 560 px; status labels kept on one line |

Each fix has a regression check in `tests/t72-sprint3-defect-regressions.test.js`, and the browser run was repeated after the fixes.

## Phone camera note (T69)

Phone browsers only allow live camera access on **https** or **localhost**. When a phone opens the laptop's address over Wi-Fi (plain http), the check-in page hides the camera button and offers **Take a photo of the QR code**, which opens the phone camera and reads the QR code from the photo, plus typing the code. For the lab demo, live scanning works on the laptop (localhost) by holding the student's phone up to the laptop camera.

## Known limitations (not blocking)

- Sessions are still kept in server memory (from Sprint 1), so users are logged out if the server restarts. Tickets and check-ins are kept.
- Removing a volunteer's access is not in Sprint 3's stories; it can be added to the backlog if needed.
