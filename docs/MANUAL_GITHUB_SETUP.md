# Manual GitHub setup

Some settings cannot be automated through `git push`. Do the following
once, after the first successful CI run.

## 1. Enable Pages

- Repository → **Settings** → **Pages**
- **Source**: **GitHub Actions**
- (No branch selection required — Actions publishes the artefact.)

## 2. Mark as Template Repository (optional)

If you want people to click "Use this template":

- Repository → **Settings** → **General**
- Scroll to **Template repository**
- ✅ Enable it.

## 3. Set default branch

If the initial push created `main` but the repo landed on a different
default:

- Repository → **Settings** → **Branches** → **Default branch** → switch to
  `main`.

## 4. Protect the default branch (recommended)

- Repository → **Settings** → **Branches** → **Add rule** on `main`:
  - ✅ Require a pull request before merging.
  - ✅ Require status checks (`ci` from `.github/workflows/ci.yml`).
  - ✅ Do not allow bypassing (unless you are solo).

## 5. Turn on Dependabot

- Repository → **Settings** → **Security** → **Dependabot**:
  - Version updates: enable for npm.
  - Security updates: enable.

## 6. First tag

The kit ships CI + demo-deploy workflows keyed on `v0.1.0`. Tagging is
usually done from a local machine:

```bash
git tag -a v0.1.0 -m "Initial knowledge test kit"
git push origin v0.1.0
```

## 7. If you get "Pages deployment not allowed"

- **Settings** → **Pages** → make sure the source is **GitHub Actions**,
  not **Deploy from a branch**.
- **Settings** → **Environments** → **github-pages** should exist. If it
  doesn't, re-run the `deploy-demo` workflow — the first successful build
  step creates it.
- If your organization restricts Pages deploys inside reusable workflows,
  switch to the inline template in `docs/DEPLOYMENT.md` Option B.
