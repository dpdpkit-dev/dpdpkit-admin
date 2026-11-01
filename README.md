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
```

`dist/` is plain static files with relative asset URLs, so any adapter can serve it from its own mount path
(for example `/dpdp/admin/`). Publishing the bundle as an artifact for the adapters is tracked as ADMIN-04.

## Status

Placeholder shell only. Screens (overview, request queue, consent analytics, retention monitor, audit export,
settings) are tracked as ADMIN-02.

Licensed under Apache-2.0.
