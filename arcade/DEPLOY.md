# Deploying AIdemy Arcade to Cloudflare Pages

The arcade is a static site (HTML/CSS/JS + one generated `data/content.json`). No build step.
This runbook covers the full pipeline: **transform → generate → deploy**.

> ⚠️ **Publish only your own derivative content.** The raw scraped course content is marked
> "never publish" (see `../CLAUDE.md`). Deploy only `content.json` built from the **transformed/**
> tree (Stage 1 below), which is reworded derivative material. See
> `../wiki/decisions/adr-3-transform-then-publish.md` for the rationale and the honest
> copyright caveat — the decision to publish is yours.

## One-time: put your API keys in `.env` (gitignored)

```
GLM_API_KEY=...            # required — GLM does the rewriting
ANTHROPIC_API_KEY=...      # only if you use --judge sonnet
```

## Stage 1 — transform + judge (offline, on your machine)

```bash
# See what it'll cost first (no API calls):
python3 arcade/transform_content.py --course advanced-rag --estimate-only

# Eyeball ONE lesson's rewrite + judge score before committing:
python3 arcade/transform_content.py --course advanced-rag --dry-run

# Transform the pilot course (GLM self-judges; use --judge sonnet for an independent judge):
python3 arcade/transform_content.py --course advanced-rag --judge glm
```

Writes reworded lessons to `transformed/` (gitignored). Cached + resumable — re-runs skip
unchanged lessons, so adding more courses later only pays for the new ones. Failing lessons are
excluded and listed in the run report, never shipped.

## Stage 2 — generate the game data (offline, deterministic, no code changes)

```bash
python3 arcade/generate_content.py --root transformed --out arcade/data/content.json
```

The generator is unchanged — `--root transformed` just points it at the derivative tree.
`content.json` lands in `arcade/data/` (gitignored).

## Stage 3 — deploy to Cloudflare Pages

```bash
npm install -g wrangler        # one-time
wrangler login                 # one-time (opens browser)
wrangler pages project create aidemy-arcade   # one-time

# Deploy the static dir (uploads content.json + the app shell):
wrangler pages deploy ./arcade --project-name aidemy-arcade
```

→ live at `https://aidemy-arcade.pages.dev`. **Build command:** none. **Output directory:** `arcade`.

Hash routing (`#/...`) works natively on Pages — no `_redirects` needed. `arcade/_headers`
sets cache rules (content.json = no-cache) and baseline security headers.

### Local sanity check before deploying

```bash
python3 -m http.server 8000 --directory arcade
# open http://localhost:8000/  — play the transformed course
```

(`fetch()` is blocked under `file://`, so always use the server — see `README.md`.)

## Scaling later (documented, not built)

- **More content:** `transform_content.py --all-courses`, re-generate, re-deploy. The cache
  means only new lessons cost API calls.
- **Accounts / cross-device progress / leaderboards:** add Cloudflare **Workers + D1/KV** on the
  same Pages project. `app.js` uses `localStorage` today; a future sync layer would be a Worker
  API — no migration off Cloudflare.

## Privacy checklist (run before any deploy)

```bash
git status   # must NOT show: transformed/, arcade/data/, .transform_cache.json, .env
```

Only the `arcade/` static bundle (app + transformed `content.json`) should ever leave your
machine, and only via the explicit `wrangler` command above.
