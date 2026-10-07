# ETMS – Event Ticket Management System for On-Campus Student Events

CPS714 Software Project Management · Section 05 · Team 03
Aneesa Masood (Product Owner / Developer) · Priyal Arora (Scrum Master / Developer) · Ravi Kumar (Developer)

ETMS lets student-club organizers create campus events and lets students browse events, get tickets and check in.
This repository holds the working Sprint 1 increment.

---

## Tech stack

| Part | Choice | Why |
|---|---|---|
| Server | **Node.js 22.13+** with **Express 5** | One language (JavaScript) for front end and back end |
| Database | **SQLite** via Node's built-in `node:sqlite` | No database server to install; the DB is one file in `data/` |
| Sessions / login | `express-session` (cookie session) + `bcryptjs` (password hashing) | Simple role-based login for a course prototype |
| Front end | Plain HTML, CSS and JavaScript (no build step) | Easy for everyone to edit |
| Tests | Node's built-in test runner (`node --test`) + `supertest` | No extra test framework to learn |

## Getting started

1. Install **Node.js 22.13 or newer** (Node 24 LTS recommended): <https://nodejs.org>. Check with `node -v`.
2. Clone the repo and install packages:
   ```bash
   git clone <repo-url>
   cd etms
   npm install
   ```
3. (Optional) copy `.env.example` to `.env` to change the port or session secret.
4. Start the app:
   ```bash
   npm start          # or: npm run dev   (restarts when files change)
   ```
5. Open <http://localhost:3000>.

The first time the server starts it creates `data/etms.db` and fills it with demo accounts and sample events.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Organizer (Computer Science Club) | `organizer@etms.test` | `Organizer123!` |
| Organizer (Robotics Club) | `robotics@etms.test` | `Organizer123!` |
| Student | `student@etms.test` | `Student123!` |

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Run the server |
| `npm run dev` | Run the server and restart on file changes |
| `npm test` | Run all 127 automated tests (uses an in-memory DB, does not touch your data) |
| `npm run seed` | Add demo data if the database is empty |
| `npm run reset-db` | Delete the local database and re-create the demo data |
| `npm run demo` | Reset to clean demo data, then start the server (use before presenting) |

## Project structure

```
etms/
├── public/                  Public pages, CSS and browser JS (anyone can load these)
│   ├── index.html
│   ├── css/styles.css
│   └── js/                  organizer-login.js, organizer-dashboard.js, create-event.js, organizer-common.js
├── src/
│   ├── server.js            Starts the app
│   ├── app.js               Builds the Express app (used by server.js and the tests)
│   ├── config.js            PORT, SESSION_SECRET, DB_PATH (from .env or defaults)
│   ├── db/                  schema.sql, database.js (connection), seed.js (demo data)
│   ├── models/              userModel.js, eventModel.js
│   ├── middleware/auth.js   requireRole / requireRolePage (role-based access)
│   ├── routes/              authRoutes.js, eventRoutes.js, pageRoutes.js
│   ├── shared/              eventValidation.js – used by BOTH server and browser
│   └── pages/organizer/     Organizer-only pages (only served through guarded routes)
├── tests/                   One test file per user story
└── data/                    Local SQLite database (git-ignored)
```

## API (Sprint 1 so far)

| Method & path | Who | What |
|---|---|---|
| `POST /api/students/signup` | anyone | `{ name, email, password, confirmPassword }` → creates a **student** account. `201`, `400 { errors }` or `409` if the email is taken |
| `POST /api/students/login` | anyone | `{ email, password }` → logs in a **student** account (`401` for wrong email/password) |
| `POST /api/organizer/login` | anyone | `{ email, password }` → logs in an **organizer** account |
| `GET /api/auth/me` | anyone | The logged-in user (`{ id, name, email, role, clubName }`) or `null` |
| `POST /api/auth/logout` | logged in | Ends the session |
| `POST /api/events` | organizer | Create an event `{ title, description, date (YYYY-MM-DD), time (HH:MM), location, capacity }`. Returns `201 { event }` or `400 { error, errors: { field: message } }` |
| `GET /api/organizer/events` | organizer | Events created by the logged-in organizer |
| `GET /api/events` | anyone | Upcoming events (later dates, or today with a start time still ahead), soonest first |
| `GET /api/events/:id` | anyone | Full details of one event, or `404 { error: 'Event not found.' }` |

Pages: `/signup` (create student account), `/login` (student login), `/organizer/login`, `/organizer` (dashboard), `/organizer/events/new` (create event),
`/events` (upcoming event list), `/events/:id` (event details).

### Adding to this (for the other Sprint 1 stories)

- **Student account / login (US01–US03):** built – see `src/routes/studentRoutes.js`, `src/shared/accountValidation.js`, `src/pages/student/` and `public/js/student-*.js`.
- **Protecting a route:** `router.get('/something', requireRole('organizer'), handler)` for APIs, or `requireRolePage('student', '/login')` for pages.
- **Event list / details (US12–US15):** built – see `src/routes/publicEventRoutes.js`, `src/pages/events/` and `public/js/event-list.js`, `event-details.js`. The list and details pages are open to everyone; once student login (US02) is merged they can be limited to students with `requireRolePage('student', '/login')` if the team wants.
- Add a test file in `tests/` for each story (copy the pattern in `tests/helpers.js`).

## Git workflow (agreed T07)

- `main` always works. Do not commit straight to `main`.
- One branch per story: `feature/US08-create-event`, `fix/...` for bugs.
- `git pull` before starting work, commit small and often, run `npm test` before opening a PR.
- Open a Pull Request into `main`, a teammate reviews, then merge.

## Sprint 1 documents

- [`docs/SPRINT1-TEST-REPORT.md`](docs/SPRINT1-TEST-REPORT.md) – story-level, end-to-end and NFR test results, defects found and fixed
- [`docs/DEMO-SCRIPT.md`](docs/DEMO-SCRIPT.md) – step-by-step Sprint 1 demo with who presents what
- `docs/screenshots/` – backup screenshots of the demo flow

## Sprint 1 progress

| Story | Tasks | Acceptance criteria → how it is met | Tests |
|---|---|---|---|
| **US01 Create attendee account** | T13 | `/signup` form (name, email, password, confirm) · every field required and checked in browser + server (valid email, password 8+ chars with a letter and a number, passwords match) · account stored with bcrypt-hashed password and role `student` · duplicate email (any capitalisation) rejected with a clear message | `tests/us01-create-account.test.js` |
| **US02 Student login** | T14 | `/login` form · valid credentials start a student session · student is recognised on every attendee page (STUDENT badge + name in header, `/api/auth/me`) · login goes to the event list `/events` | `tests/us02-student-login.test.js` |
| **US03 Invalid student login** | T15 | Wrong password / unknown email → no access, no session cookie · same clear message "Incorrect email or password. Please try again." · user stays logged out | `tests/us03-invalid-login.test.js` |
| **US13 Event list information** | T22, T23 | Each card on `/events` shows title, date/time, location (and club) · values come from that event's own record and the card links to the same id | `tests/us13-event-list-info.test.js` |
| **US05 Organizer login** | T16 | Organizer enters email + password on `/organizer/login` · valid credentials start an organizer session and open the dashboard · session stores `role: 'organizer'` (shown in header, returned by `/api/auth/me`) | `tests/us05-organizer-login.test.js` |
| **US06 Organizer-only functions** | T17 | Logged-in organizer reaches dashboard, create-event page and organizer APIs · students get **403 Access denied** on organizer pages and APIs; logged-out users are redirected to login | `tests/us06-organizer-only.test.js` |
| **US08 Create event** | T18, T10 | Form has title, description, date, time, location, maximum capacity · *Create event* submits to `POST /api/events`, which stores it and shows it on the dashboard | `tests/us08-create-event.test.js` |
| **US09 Event validation** | T19 | All six fields required (blank/whitespace rejected) · rejects past dates, impossible dates, bad times, capacity that is 0 / negative / decimal / text / > 5000, over-long text · clear message per field + summary box; checked in browser **and** on the server with the same rules | `tests/us09-event-validation.test.js` |

| **US10 Save event** | T20 | Valid events are inserted into the `events` table · still there after navigating away and after a server restart (saved to the DB file) · every stored field matches what was submitted | `tests/us10-save-event.test.js` |
| **US12 Upcoming event list** | T21 | `/events` page (linked from the home page) · `GET /api/events` returns upcoming events only, soonest first, from every club · newly saved events appear | `tests/us12-upcoming-events.test.js` |
| **US14 Select event** | T24 | Each event card links to `/events/<id>` · the selected event's own data is loaded by id · bad / unknown ids show "Event not found." instead of another event | `tests/us14-select-event.test.js` |
| **US15 Event details** | T25 | Details page shows title, description, date, time, location, capacity (and hosting club) · values come straight from the saved event | `tests/us15-event-details.test.js` |

Validation rules: title 3–100 characters; description up to 2000; location up to 150; date must be a real calendar date, today or later (and if today, the time must still be ahead); time `HH:MM` 24-hour; capacity a whole number from 1 to 5000.
