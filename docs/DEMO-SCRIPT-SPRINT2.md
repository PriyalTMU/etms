# Sprint 2 Demo Script – ETMS (Lab: Wednesday, Oct 21)

**Goal shown:** a student registers for a campus event → gets a ticket with a unique ID and QR code → finds it on My Tickets; a full event refuses more registrations and a second registration is blocked.
**Length:** about 5 minutes.

## Before the demo

```bash
cd ~/Desktop/CPS714/etms      # or wherever the repo is
git pull
npm install                    # installs the new qrcode package
npm test                       # expect: pass 183, fail 0
npm run demo                   # resets to clean sample data and starts the app
```

Open **http://localhost:3000**, zoom to ~125%, make sure you are logged out. Keep `docs/screenshots/sprint2/` open as a backup.

## Accounts

| Who | Email | Password |
|---|---|---|
| Organizer | `organizer@etms.test` | `Organizer123!` |
| Student 1 | `student@etms.test` | `Student123!` |
| Student 2 (create live) | `sam@torontomu.ca` | `Campus2026` |

Event to create: **Board Game Night** · description `Two tables of board games in the lounge.` · a future date · `19:00` · `Student Lounge, SCC 115` · capacity **1** (so it fills up during the demo).

## Script

| # | Presenter | Do | Say | Story |
|---|---|---|---|---|
| 1 | Priyal | Log in as organizer, create **Board Game Night** with capacity 1, log out | "One spot, so we can show what happens when it's full." | – |
| 2 | Ravi | Open **Browse upcoming events** | "Every card now shows how many tickets are left." | US19 |
| 3 | Ravi | Open Board Game Night while logged out | "Logged-out visitors are asked to log in before registering." | US17 |
| 4 | Aneesa | **Log in to register** → student@etms.test → you come straight back to the event | | US17 |
| 5 | Priyal | Click **Register for this event** | "The ticket is issued and saved to the account." | US17, US18 |
| 6 | Ravi | Point at the ticket code and QR code | "Every ticket has its own random code, and the QR code holds exactly that code for check-in next sprint." | US23, US24 |
| 7 | Aneesa | Point at event info on the ticket, then click **My tickets** in the header | "All registrations in one place, each with its event details." | US25, US26, US27 |
| 8 | Aneesa | Click the ticket on My Tickets | "Opens that ticket's details and QR code." | US28 |
| 9 | Priyal | Go back to the event | "Already registered – it links to the ticket instead of letting you register twice. Tickets left is now 0 of 1." | US22, US19 |
| 10 | Priyal | Log out, sign up `sam@torontomu.ca`, log in, open the event | "Event full – the button is disabled and the message is clear." | US20, US21 |
| 11 | Ravi | (Optional) mention the concurrency test | "12 students at once for 5 spots gives exactly 5 tickets." | US20 |

## If something goes wrong

- App won't start → `node -v` must be 22.13 or newer; run `npm install` again (new `qrcode` package).
- Data looks messy → stop the server, `npm run demo`.
- Show the screenshots in `docs/screenshots/sprint2/` in the same order.
