# Deployment (GitHub Pages)

This file was scaffolded by `knowledge-test deploy-init`.

## Enable Pages

1. Push your changes to the default branch.
2. Repository **Settings → Pages → Source → GitHub Actions**.
3. The workflow at `.github/workflows/pages.yml` triggers on every push to
   `main` (or via **Actions → Deploy Knowledge Test → Run workflow**).

## What the workflow does

It calls the kit's reusable workflow at

```
clt123321/knowledge-test-kit/.github/workflows/deploy-content-site.yml@v0.1.1
```

which:

1. Checks out your content repository into `content-repo/`.
2. Checks out the kit at the requested `kit_ref` into `kit/`.
3. Runs `npm ci` inside `kit/`.
4. Runs `knowledge-test validate --content ../content-repo/${content_path}`.
5. Runs `knowledge-test build --content ../content-repo/${content_path}` with
   `GITHUB_REPOSITORY` set, so the Pages base path is derived automatically.
6. Uploads `apps/site/dist/` as a Pages artifact.
7. Deploys the artifact to GitHub Pages.

## Manual fallback

If your account has restrictions on reusable-workflow Pages deploys, replace
the `uses:` line with the inline template shown in
`docs/DEPLOYMENT.md` of the kit repo.
