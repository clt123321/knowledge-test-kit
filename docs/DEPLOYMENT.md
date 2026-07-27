# Deploying to GitHub Pages

## Option A — reusable workflow (recommended)

Your content repo's `.github/workflows/pages.yml`:

```yaml
name: Deploy Knowledge Test

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    uses: clt123321/knowledge-test-kit/.github/workflows/deploy-content-site.yml@v0.1.1
    with:
      kit_ref: v0.1.1
      content_path: .
```

Then: **Settings → Pages → Source → GitHub Actions**.

## Option B — inline workflow (fallback)

Some accounts/organizations restrict Pages deploys inside reusable
workflows. If so, inline the same steps in your repo:

```yaml
name: Deploy Knowledge Test

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout content
        uses: actions/checkout@v4
        with:
          path: content-repo
      - name: Checkout kit
        uses: actions/checkout@v4
        with:
          repository: clt123321/knowledge-test-kit
          ref: v0.1.0
          path: kit
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: kit/package-lock.json
      - run: npm ci
        working-directory: kit
      - run: node packages/cli/bin/knowledge-test.mjs validate --content ../content-repo
        working-directory: kit
      - env:
          GITHUB_REPOSITORY: ${{ github.repository }}
        run: node packages/cli/bin/knowledge-test.mjs build --content ../content-repo
        working-directory: kit
      - uses: actions/upload-pages-artifact@v3
        with:
          path: kit/apps/site/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Base path derivation

The CLI reads `GITHUB_REPOSITORY` at build time. For a repo
`owner/knowledge-test-kit`, Pages serves the site under
`/knowledge-test-kit/`, and the kit sets Astro's `base` accordingly.

For a **user site** (`owner.github.io`) or a custom domain, override with
`--base /`:

```
node packages/cli/bin/knowledge-test.mjs build --content . --base /
```

## Local vs deployed URLs

- `knowledge-test dev` → `http://localhost:4321/` (base `/`).
- `knowledge-test build` in CI → `/<repo>/`.
- `knowledge-test build --base /custom/` → `/custom/`.

## Troubleshooting

- **404 on assets** — you probably deployed without `GITHUB_REPOSITORY`
  set. Re-run with `--base /<repo>/` or set the env var.
- **Search bar shows no results** — Pagefind indexing failed. Check the
  CI log for the `pagefind --site dist` step.
- **Practice records disappear between banks** — expected: records are
  namespaced by `site.id` in `knowledge-test.config.json`.
