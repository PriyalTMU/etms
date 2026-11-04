# Sprint 3 Demo Script – ETMS (Lab: Wednesday, Nov 4)

**Goal shown:** organizer gives a volunteer check-in access → volunteer opens the assigned event → scans or types tickets → valid ticket checked in, invalid / wrong-event / already-used rejected → organizer sees attendance.
**Length:** about 6 minutes. Use **Chrome** on the laptop (live camera works on `localhost`).

## Before the demo

```bash
cd ~/Desktop/CPS714/etms
git pull
npm install                    # installs the new jsqr package
npm test                       # expect: pass 229, fail 0
npm run demo                   # clean sample data, starts the app
```

Open **http://localhost:3000**. Use two browser windows: a normal one and a private/incognito one, so two people can be logged in at once.

## Accounts

| Who | Email | Password |
|---|---|---|
| Organizer | `organizer@etms.test` | `Organizer123!` |
| Student with a ticket | `student@etms.test` | `Student123!` |
| Volunteer (create live) | `val@torontomu.ca` | `Campus2026` |

## Script

| # | Presenter | Do | Say | Story |
|---|---|---|---|---|
| 1 | Aneesa | **Window 1:** log in as student@etms.test, open **Intro to Git Workshop**, **Register**. Keep the ticket (QR code) on screen. | "Here's a Sprint 2 ticket we'll check in." | – |
| 2 | Priyal | **Window 2 (private):** **Create an account** for Val (val@torontomu.ca). Then open `/checkin/events/1` | "A normal student has no check-in access." | US31 |
| 3 | Priyal | **Window 2:** log out, log in as the organizer → **Tickets, attendance & volunteers** on Intro to Git Workshop → type `nobody@torontomu.ca` | "Invalid assignments are rejected clearly." | US29 |
| 4 | Priyal | Type `val@torontomu.ca` → **Give check-in access** | "Val now has access to this event only." | US29 |
| 5 | Ravi | **Window 2:** log out, log in as Val → **Check-in** in the header → the event | "The page shows exactly which event we're managing." | US30 |
| 6 | Ravi | **Scan QR code with camera** and hold Window 1's QR code (or a phone showing it) up to the laptop camera – or type the code | "Valid – let them in." | US32, US33, US36 |
| 7 | Ravi | Type the same code again | "Already used – with the time and who checked it in." | US35 |
| 8 | Aneesa | Type `ETMS-2222-3333-4444` | "Unknown codes are rejected." | US34 |
| 9 | Aneesa | **Window 2:** log in as organizer → event page → **Tickets & attendance** → *Checked in* filter | "Issued, checked in and not yet arrived – it refreshes by itself." | US37, US38 |

Optional: register a second student for **Hackathon Kickoff Night** and type that code on the Git Workshop check-in page → **WRONG EVENT** (US34).

## If something goes wrong

- Camera won't open → allow camera access in Chrome, or type the code (same result).
- On a phone over Wi-Fi the camera button is replaced by **Take a photo of the QR code** – that is expected (phones need https for live camera).
- Data looks messy → stop the server, `npm run demo`.
- Backup: `docs/screenshots/sprint3/`.
