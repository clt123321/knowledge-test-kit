# {{BANK_TITLE}}

A knowledge test bank generated with
[`knowledge-test-kit`](https://github.com/clt123321/knowledge-test-kit).

## Layout

```
questions/          JSON question files (validated against the kit schema)
references/         Books / papers / official docs
syllabus/           Human-readable authoring notes
reviews/            Review packages and audit logs
knowledge-test.config.json
.github/workflows/pages.yml
```

## Local

```bash
# using the kit checked out at a sibling directory
npx knowledge-test dev --content .

# or, once the kit is published to npm:
# npm i -D @clt123321/knowledge-test-kit
# npx knowledge-test dev
```

## Deploy

1. Push this repo to GitHub.
2. Settings → Pages → Source → **GitHub Actions**.
3. The included `.github/workflows/pages.yml` calls the kit's reusable
   workflow at `clt123321/knowledge-test-kit@v0.1.1`.

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) in the kit for details.
