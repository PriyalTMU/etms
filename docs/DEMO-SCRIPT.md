# Sprint 1 Demo Script – ETMS (T30)

**Goal shown:** Organizer logs in → creates an event → event is saved → student logs in → views upcoming events → selects the event → views the event details.
**Length:** about 5 minutes.

## Before the demo (5 minutes before)

```bash
cd ~/Desktop/CPS714/etms
git pull
npm install
npm test            # expect: pass 127, fail 0
npm run demo        # resets to clean sample data and starts the app
```

- Open **http://localhost:3000** in a browser, zoom to ~125%.
- Make sure you are logged out (home page header shows "Student login · Organizer login").
- Keep `docs/screenshots/` open in another window as a backup.

## Accounts

| Who | Email | Password |
|---|---|---|
| Organizer | `organizer@etms.test` | `Organizer123!` |
| New student (create live) | `jordan@torontomu.ca` | `Campus2026` |
| Existing student (backup) | `student@etms.test` | `Student123!` |

Event to create: **CPS714 Demo Night** · description `Team 03 shows the Sprint 1 increment.` · a future date · `18:30` · `ENG 103` · capacity `80`.

## Script

| # | Presenter | Do | Say | Story |
|---|---|---|---|---|
| 1 | Priyal | Home → **Organizer login**, type wrong password | "Wrong credentials are rejected." | US05 |
| 2 | Priyal | Log in as organizer | "Organizer badge and club name – the role is recognised." | US05 |
| 3 | Priyal | Click **+ Create event**, press **Create event** with nothing filled in | "Every required field is flagged." | US06, US09 |
| 4 | Priyal | Capacity `0`, yesterday's date | "Clearly invalid values are rejected with clear messages." | US09 |
| 5 | Priyal | Fill in the event properly and submit | "Created – it's on our dashboard." | US08 |
| 6 | Ravi | Refresh the page | "Saved in the database, still there after reload." | US10 |
| 7 | Priyal | **Log out** | | |
| 8 | Aneesa | **Create an account** → submit a bad email + short password first, then valid details | "Validation, then the account is created." | US01 |
| 9 | Aneesa | Log in with a wrong password | "Rejected, still logged out." | US03 |
| 10 | Aneesa | Log in correctly | "Student badge and name – lands on the event list." | US02 |
| 11 | Aneesa | Point at the list | "Upcoming events only, each with title, date/time, location." | US12, US13 |
| 12 | Ravi | Click **CPS714 Demo Night** | "Selecting opens that exact event." | US14 |
| 13 | Ravi | Point at the details | "Everything the organizer entered: title, description, date, time, location, capacity." | US15 |
| 14 | Priyal | Type `localhost:3000/organizer` in the address bar | "Students can't reach organizer functions." | US06 |
| 15 | Priyal | Terminal: `npm test` (or show the earlier result) | "127 automated checks, all passing." | T27/T28 |

## If something goes wrong

- **App won't start / port in use:** close other terminals, run `npm run demo` again.
- **"needs Node.js 22.13":** install Node LTS from nodejs.org (do this the day before).
- **Account already exists (step 8):** use a different email such as `jordan2@torontomu.ca`, or run `npm run reset-db` before the demo.
- **Laptop / projector problems:** walk through the screenshots in `docs/screenshots/`.
