# agentscrape-frontend

Frontend for the contact-extraction platform. Browse schools and the people
found on each institution's site, launch staff-only crawls, and review where
every value came from.

Built on the UI by [@Carsonshef](https://github.com/Carsonshef/frontend) and
wired to the [agentscrape backend](https://github.com/marvalarva2929/agentscrape).

## Running locally

```bash
npm install
cp .env.example .env.local     # points at http://localhost:8000/api/v1
npm run dev                    # http://localhost:5173
```

The backend must be running:

```bash
cd ../agentscrape
docker compose up -d && uv run alembic upgrade head
uv run uvicorn agentscrape.api.main:app --port 8000
```

Set `VITE_USE_MOCK_API=true` to run entirely on the built-in mock data with no
backend at all.

## Pointing the app at a backend

The API address is resolved **at runtime**, not baked into the build, so the same
deployed bundle can reach whichever backend is up. In order of precedence:

1. `?api=https://your-backend/api/v1` in the URL (remembered afterwards)
2. the address entered under "Change backend address" on the login screen
3. `VITE_API_BASE_URL` at build time
4. `http://localhost:8000/api/v1`

### A note on GitHub Pages

Pages is HTTPS-only. A browser on an HTTPS page **will not** connect to a backend
on plain `http://`, so a deployed build cannot talk to a backend running on your
laptop directly — the login screen detects this and says so. Two ways round it:

- **Run everything locally** (`npm run dev`), which has no such restriction; or
- **Expose the backend over HTTPS**, e.g. `cloudflared tunnel --url http://localhost:8000`,
  then open the deployed site with `?api=https://<tunnel-host>/api/v1`.

Whichever you use, add that origin to `CORS_ORIGINS` in the backend's `.env`.

## Deploying

The live site is published from the `gh-pages` branch:
<https://marvalarva2929.github.io/agentscrape-frontend/>

```bash
BASE_PATH=/agentscrape-frontend/ npm run build
cp dist/index.html dist/404.html     # client-side routes
# publish dist/ to the gh-pages branch
```

`.github/workflows/deploy.yml` automates this on every push to `main`, but
pushing a workflow file needs the `workflow` OAuth scope. If `git push` is
rejected with *"refusing to allow an OAuth App to create or update workflow"*,
run:

```bash
gh auth refresh -s workflow
```

then push again and switch Pages to "GitHub Actions" under
Settings → Pages. Until then the `gh-pages` branch is the source of truth.

## Two passwords

| Password | Grants |
|---|---|
| `APP_PASSWORD` | Browse schools, people, sources and exports |
| `ADMIN_PASSWORD` | The above, plus launching billable school crawls |

Launching a crawl is billable, so clients email requested schools and staff
populate/run them separately.

## Screens

- **Schools → People** — the main navigation
- **Person** — every field with its source page, capture time and a screenshot
  with the exact fields highlighted
- **Past crawls** — crawls take minutes and there are no notifications, so this
  is how you come back to a finished run
- **Run monitor** — live progress over SSE, including the skipped state when a
  site has not changed
