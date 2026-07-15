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

## Stage 3 — deploy to Cloudflare Pages (CI/CD)

Deploys run in **GitHub Actions** (`.github/workflows/deploy.yml`), live at
`https://ai-arcade-13g.pages.dev`. Two triggers:

- **Code change** (index.html/app.js/styles.css/_headers) → `git push` to the public
  `ai-arcade` repo → the workflow auto-deploys.
- **Content change** (new/updated courses) → run `./deploy-content.sh` from the project root.

### Why content doesn't live in the public repo

`content.json` is derived from purchased content, so it is **not** in the public `ai-arcade`
repo. It lives in a **private** repo, `iamr1ddl3/ai-arcade-content` (content.json only). The
CI job checks out the app shell from the public repo, pulls `content.json` from the private
repo, assembles a clean `dist/` (4 static files + content), and runs `wrangler pages deploy`.
Raw source, `transformed/`, `.env`, and API keys never leave your machine.

> ⚠️ **Do NOT use `wrangler pages deploy ./arcade`.** That uploads the whole folder incl.
> `.transform_cache.json` and the Python scripts. `.assetsignore` does **not** work for Pages
> deploys. The pipeline (and `deploy-content.sh`) always deploy a clean `dist/` — use them.

### One-time setup — GitHub Secrets (you set these; they are never in code)

In the `ai-arcade` repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | `8fd44aa3c6082eb1f8d8e40e577a3c3b` (from `wrangler whoami`) |
| `CONTENT_REPO_TOKEN` | Fine-grained GitHub PAT with **read** access to `ai-arcade-content` |

### Adding content later

```bash
python3 arcade/transform_content.py --course <new-course> --judge glm   # local, costs API $
./deploy-content.sh    # regenerate content.json → push to private repo → trigger deploy
```

The transform cache means only new lessons cost API calls.

### Local sanity check before pushing

```bash
python3 -m http.server 8000 --directory arcade
# open http://localhost:8000/  — play the transformed course
```

(`fetch()` is blocked under `file://`, so always use the server — see `README.md`.)

## Scaling later

- **More content:** `transform_content.py --all-courses`, then `./deploy-content.sh`. The cache
  means only new lessons cost API calls. (Content deploy is now automated — see Stage 3.)
- **Accounts / cross-device progress / leaderboards:** add Cloudflare **Workers + D1/KV** on the
  same Pages project. `app.js` uses `localStorage` today; a future sync layer would be a Worker
  API — no migration off Cloudflare.

## Privacy checklist

```bash
git status   # public repo must NOT show: transformed/, arcade/data/, .transform_cache.json, .env
```

- **Public repo (`ai-arcade`):** app shell + wiki only. No content.
- **Private repo (`ai-arcade-content`):** `content.json` only — never raw source, `.env`, or keys.
- **Never** `raw/` anywhere off your machine (immutable purchased source).
- The CI job deploys a clean `dist/` (4 static files + content.json) — nothing else ships.
