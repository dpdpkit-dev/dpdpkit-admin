# dpdpkit-admin

The self-hosted admin dashboard for [dpdpkit](https://github.com/dpdpkit-dev): a React + Vite app that is
compiled to static files and bundled into the adapters and the server image. It reads the admin endpoints of
whichever dpdpkit backend serves it.

> **Disclaimer.** dpdpkit is software that helps you implement obligations under India's Digital Personal
> Data Protection Act, 2023 and the DPDP Rules, 2025. It does not provide legal advice and does not
> guarantee compliance.

## Develop

```bash
npm ci
npm run dev        # Vite dev server
npm test           # unit tests
npm run build      # type-check, then static files in dist/
npm run e2e        # every screen against the fastapi_shop example, using the installed Chrome
```

`npm run e2e` expects a dpdpkit-fastapi checkout at `../dpdpkit-fastapi` (or `DPDPKIT_FASTAPI_DIR`) and a Python
with it installed in `DPDPKIT_PYTHON`.

`dist/` is plain static files with relative asset URLs. The adapters serve it at `<prefix>/admin/ui/` and the
dashboard takes its API base from that path, so `/dpdp/admin/ui/` calls `/dpdp`. Change it under Settings if your
API is elsewhere.

## Consume the bundle

Each `vX.Y.Z` tag publishes `dpdpkit-admin-X.Y.Z.tar.gz` (with a `.sha256` file) on the GitHub release. The
archive root is the bundle itself (`index.html` at the top level). dpdpkit-fastapi and dpdpkit-django pin a version
in their `admin-bundle.version` file and add that bundle to their wheels when they build a release.

## Status

Screens: overview, request queue, consent analytics, retention monitor, incident register, audit export and
settings. Settings shows the current notice and purposes read-only. Editing settings, webhooks, API keys, team
roles, templated responses and failed-notification counts need backend support first and aren't here yet.

Licensed under Apache-2.0.
