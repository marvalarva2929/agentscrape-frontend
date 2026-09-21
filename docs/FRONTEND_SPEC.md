# Frontend Specification

What the app is for, who uses it, every screen, and what each one must do.
Written as input for a redesign: it describes **behaviour and content**, not
visual style. Layout, typography and colour are open.

The backend already supports everything described here unless a section says
otherwise.

---

## 1. What the product does

We collect the people published on medical schools' and teaching hospitals'
websites — residents, fellows, faculty, program directors, coordinators, staff,
students and alumni — and keep that list current over time.

A client pays per school. They ask us for schools; **our staff** run the
collection. The client then browses the results, checks where any value came
from, and exports lists for outreach.

The things a client cares about most, in order:

1. **Name and training year** for each person
2. Whether that person is **still listed** on the site or has dropped off
3. Email address — a bonus when the site publishes one, not a requirement

---

## 2. Who uses it

There are no user accounts. There are two passwords.

| Role | Password grants | Cannot |
|---|---|---|
| **Client** | Browse schools and people. View sources. Export. | Start or cancel a collection run. |
| **Staff (admin)** | Everything the client can do, plus starting runs with a budget and past-run costs. | — |

Design implication: **one app, with staff-only areas hidden** for clients, not
two separate apps. Anything that spends money is staff-only.

---

## 3. Product rules the design must respect

These were decided with the client. A design that breaks one of them is wrong,
however good it looks.

1. **Everyone on the site is collected, and labelled.** Each person has a
   *category* (for filtering) and a *position* (their title, exactly as the site
   printed it). Nobody is filtered out for being faculty, staff or alumni.
2. **Nothing is guessed.** If a site doesn't state a value, the field is blank.
   Design blank fields as normal and expected, not as errors. A resident with no
   email and no class year is a perfectly good record.
3. **Years are shown exactly as printed**, with the date we read them.
   "PGY-2 · as of 13 Sep 2026" — never rolled forward to "PGY-3 now".
4. **People are never deleted.** When someone disappears from a site they stay
   in the list, marked **Missing**, and **sort to the bottom**.
5. **Every value is traceable.** From any person you can see the page it came
   from, when we read it, and a screenshot with the exact spot highlighted.
6. **Clients request; staff run.** No client-facing "start crawl" button.
7. **The only control on a run is a dollar budget.** No concurrency, step
   counts, thresholds or goals in the UI.

---

## 4. Global states

These apply on every screen.

| State | When | Should |
|---|---|---|
| **Backend offline** | The server is started on demand and stopped when idle, so this is normal, not a crash. | A calm full-page state ("The service is currently offline") with a retry. Not an error toast. |
| **Signed out** | No session, or the session expired. | Go straight to Sign in. Not an error message. |
| **Loading** | Any data fetch. | Skeleton or spinner. Lists can be long (hundreds of people). |
| **Empty** | No schools, people or runs yet. | Explain that staff will add requested schools after the client emails them. |
| **Staff-only area, client signed in** | Client opens a staff URL directly. | "This area needs the staff password." |

---

## 5. Screens

### 5.1 Sign in

**Who:** everyone.

- Password field and **Sign in**.
- The password decides the role (client or staff). There is no username.
- **Backend address** — a small, collapsed "Advanced" control to change the API
  URL. The same deployed site has to be pointable at different servers.
- If the page is HTTPS and the backend address is plain HTTP, show a clear
  warning that the browser will block it. (Most common setup failure.)
- Wrong password: inline message under the field.

---

### 5.2 Schools

**Who:** everyone. **Purpose:** pick a school.

Each school shows:

- Name (fall back to the website domain if there is no name)
- Location
- Number of people
- Last updated

Actions:

- Search by name
- Open a school → its people

Empty state for a client: tell them to email the schools they want added.

---

### 5.3 School → People

**Who:** everyone. **Purpose:** the list the client actually works with.

**Summary figures** at the top: total people, residents, fellows, emails found,
last updated.

**Table columns**, in order of importance:

| Column | Notes |
|---|---|
| Name | Always present. |
| Year | e.g. "PGY-2". Blank when not stated. |
| Role | Category: Resident, Fellow, Faculty, Staff, Student, Alumni, Unknown. |
| Position | Title as printed, e.g. "Chief Resident", "Program Director". Often blank. |
| Email | Often blank; that's fine. |
| Status | New · Active · **Missing** |
| Last seen | Date we last saw them on the site. |

**Filters:** search (name or email), role, year, status.

**Sorting:** default by name, with **Missing people always last** regardless of
sort, visibly de-emphasised.

**Actions:**

- Open a person → Person detail
- **Export** this school (see 5.6)

Lists can be long; paginate or virtualise. The backend pages results, so the UI
must load all pages — a list that silently stops at 50 is a bug.

---

### 5.5 Person detail

**Who:** everyone. **Purpose:** everything we know about one person, and proof
of where it came from.

**Details:** name, role, position, year, specialty, class of, email, status.
Only show fields that have a value.

**Source of truth** — the most important part of this screen:

- The **page title** and **link** to the exact page it came from ("Open source")
- **When** we read it
- A **screenshot** of that page as it looked, with **highlight boxes over the
  exact name and email** we read. The screenshot can be tall; it needs to scroll
  or zoom, and the boxes must stay aligned with the image at any size.
- If the screenshot is no longer stored, say so plainly and still show the link,
  title and date. (Screenshots are replaced when a school is collected again.)

**History** (low priority): a timeline of values that changed between
collections. The client said this matters less than present/missing, so it can
be collapsed or secondary.

**Do not show** a confidence score. It exists in the data but is not meant for
the client.

---

### 5.6 Export

**Who:** everyone. **Purpose:** download a school's list for outreach.

- Starts from a school (5.3).
- Exports are generated in the background: show "Preparing…", then a download
  button when ready. Usually seconds.
- The file is a CSV with these columns:
  Hospital · Program · Specialty · R/F · Position · Full Name · PGY · Class of ·
  Email · Status · Last Seen
- No source URLs or screenshots in the file — those are for checking in the app.

*Not built in the current UI.*

---

### 5.8 Past crawls

**Who:** everyone (staff get more detail). **Purpose:** runs take minutes and
there are no notifications, so this is how anyone comes back to see what
happened.

Each run shows:

- Which school(s)
- Started, duration
- Status (see 5.9)
- People found, new, missing
- Spend — **staff only**

Open a run → Run monitor.

---

### 5.9 Run monitor

**Who:** everyone can watch; only staff can cancel. **Purpose:** live progress
of a collection run, and its result.

**While running:**

- **Stage**, as a simple step indicator:
  Queued → Discovering pages → Reading directories → Finalizing → Complete
- **Progress** percentage
- Elapsed time
- Live counters: people found, new, missing, emails found
- Spend so far against the budget — **staff only**
- Optional: current activity ("Reading https://…/residents", step N)
- **Cancel** — staff only

Updates arrive live. If the connection drops, reload the snapshot rather than
showing stale numbers; a dropped connection is not an error, because the server
may simply have been stopped.

**Possible outcomes — each needs its own clear end state:**

| Outcome | What to show |
|---|---|
| **Completed** | Totals: found, new, missing. Link back to the school. |
| **Stopped at budget** | "Stopped when it reached the $X budget." Not a failure — everything collected so far is kept and valid. |
| **Failed** | Short reason. Often a site was unreachable. People previously collected are kept. |
| **Cancelled** | What was collected before cancelling is kept. |

---

### 5.10 Staff: Overview (optional)

**Who:** staff only. *Backend exists; no UI yet.*

Health of the system at a glance:

- Total schools, people, active vs missing
- **Total spend**
- **Known-page hit rate** — share of runs where a previously productive page
  paid off again

The last two show whether repeat collection is getting cheaper over time; they
should trend up.

---

## 6. Data reference

### Person

| Field | Always present | Notes |
|---|---|---|
| Name | yes | |
| Role (category) | yes | resident, fellow, faculty, staff, student, alumni, unknown |
| Position | no | title as printed |
| Year (PGY) | no | as printed, with the date read |
| Class of | no | as printed |
| Specialty | no | normalised, e.g. "Internal Medicine" |
| Email | no | |
| Status | yes | new, active, missing |
| Last seen | yes | |
| Source | yes | page URL, title, date read |
| Screenshot | no | may have expired; has highlight boxes when present |

### Run status

Queued · Running · Completed · **Stopped at budget** · Cancelled · Failed

---

## 7. Deliberately not in the product

Don't design these:

- Phone numbers
- "Has been emailed" or any outreach tracking
- User accounts, sign-up, roles management
- Notifications or email alerts
- A client-facing "start crawl" button
- Concurrency, step budgets, thresholds, people goals
- Confidence scores
- A prominent "what changed" diff view (history is secondary)

---

## 8. Gaps in the current implementation

For whoever builds the new design against the existing app:

- **No Export button** (5.6).
- **Staff Overview not built** (5.10).
- **Past crawls doesn't show which school** a run was for.
- The app is still named "Residency Monitor", though it now covers everyone at a
  school. Worth renaming.

---

## 9. Open questions

- **"Check anyway"** starts a paid run. It should stay staff-only.
- Should clients ever see **spend**, or only staff?
- Is the **Staff Overview** (5.11) wanted?

---

## Appendix: which API backs each screen

For wiring, not for design.

| Screen | Endpoints |
|---|---|
| Sign in | `POST /auth/login`, `GET /auth/session`, `POST /auth/logout` |
| Schools | `GET /schools` |
| People | `GET /schools/{id}/people`, `GET /people/stats` |
| Person | `GET /people/{id}`, `GET /people/{id}/source`, `GET /people/{id}/versions` |
| Export | `POST /people/export`, `GET /people/export/{id}` |
| Past crawls | `GET /runs` |
| Run monitor | `GET /runs/{id}`, `GET /runs/{id}/events` (live), `GET /runs/{id}/sites`, `POST /runs/{id}/cancel` |
| Overview | `GET /admin/stats` |
| Offline check | `GET /health` |

All under `/api/v1`. Full reference at `/api/v1/docs` on a running backend.
