# Sprint 4 Demo Script – ETMS (Sprint 4 Review lab)

**Goal shown:** organizer edits or cancels an event → changes appear to students → student searches/filters → selects an event → free or demo-paid status shown → registers or completes the simulated checkout → result shown → ticket issued → student cancels the ticket → availability restored.
**Length:** about 7 minutes. Use **Chrome**. Two windows: a normal one (organizer) and a private/incognito one (student).

## Before the demo

```bash
cd ~/Desktop/etms
git pull
npm install
npm test                       # expect: pass 307, fail 0
npm run demo                   # clean sample data (8 events incl. a demo-paid gala), starts the app
```

Open **http://localhost:3000** in both windows.

## Accounts

| Who | Email | Password |
|---|---|---|
| Organizer (Computer Science Club) | `organizer@etms.test` | `Organizer123!` |
| Student | `student@etms.test` | `Student123!` |

## Script

| # | Presenter | Do | Say | Story |
|---|---|---|---|---|
| 1 | Priyal | **Window 1:** log in as organizer. Point at the category and Free/Demo-paid badges on each card. | "Every event now has a category and a payment type." | US51 |
| 2 | Priyal | **Hackathon Kickoff Night → Edit event →** set capacity to `0`, Save. | "Invalid changes are rejected with the same rules as creating." | US39 |
| 3 | Priyal | Capacity back to `120`, location `SLC 7th floor`, Save. | "Saved – only I can edit my own events." | US39 |
| 4 | Aneesa | **Window 2:** log in as student → **Browse events** → open Hackathon Kickoff Night. | "The new location shows straight away." | US40 |
| 5 | Priyal | Window 2: type `gala` in Search, then `zzz`. | "Keyword search, and a clear message when nothing matches." | US45 |
| 6 | Ravi | Clear the search. Category **Sports**, then **All categories** and a From/To date range. **Clear search & filters.** | "Category and date filters, combined, and one click to reset." | US46 US47 US48 |
| 7 | Priyal | Open **Winter Formal Gala**. | "Demo-paid, $15 – it goes through a simulated checkout." | US52 |
| 8 | Ravi | **Continue to demo checkout** → point at the DEMO banner → **Simulate a declined payment**. | "No real payment, no card details. A declined payment issues no ticket." | US53 |
| 9 | Ravi | **Try again → Complete demo payment** (double-click on purpose). | "One ticket is issued even with a double click – with its QR code." | US54 |
| 10 | Aneesa | Point at the green confirmation. Open **My tickets**. | "The confirmation names the event; the ticket is in My Tickets." | US49 |
| 11 | Aneesa | Open the Gala ticket → **Cancel my ticket… → Yes, cancel my ticket**. | "Clear confirmation; the ticket is marked cancelled and can't be used." | US42 US44 |
| 12 | Aneesa | Back to the Gala page. | "The spot went back – 150 of 150 tickets left again." | US43 |
| 13 | Priyal | **Window 1:** open **Fall Photography Walk → Cancel event…**, reason `Rain forecast`, **Yes, cancel this event**. | "Cancelled, not deleted – check-in and editing are switched off." | US41 |
| 14 | Aneesa | **Window 2:** event list → Fall Photography Walk. | "Students see it's cancelled and why, and registration is closed with a reason." | US41 US50 |
| 15 | Ravi | Terminal: `npm test`. | "307 automated checks pass, including all of Sprints 1–3." | T98 T99 |

## If something goes wrong

- **Need a clean start:** stop the app (Ctrl + C) and run `npm run demo` again.
- **Gala already has your ticket:** cancel it from My Tickets first, or use another student account (create one on the Sign up page).
- **Laptop / projector problems:** use `docs/screenshots/sprint4/` (numbered in demo order).
