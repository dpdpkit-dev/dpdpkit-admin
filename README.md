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
(for example `/dpdp/admin/`).

## Consume the bundle

Each `vX.Y.Z` tag publishes `dpdpkit-admin-X.Y.Z.tar.gz` (with a `.sha256` file) on the GitHub release. The
archive root is the bundle itself (`index.html` at the top level). The fastapi, django and server builds
download the asset at the release version and extract it into their static directory:

```bash
v=0.4.0
base=https://github.com/dpdpkit-dev/dpdpkit-admin/releases/download/v$v
curl -fsSLO $base/dpdpkit-admin-$v.tar.gz -O $base/dpdpkit-admin-$v.tar.gz.sha256
sha256sum -c dpdpkit-admin-$v.tar.gz.sha256
mkdir -p <static dir> && tar -xzf dpdpkit-admin-$v.tar.gz -C <static dir>
```

## Status

Placeholder shell only. Screens (overview, request queue, consent analytics, retention monitor, audit export,
settings) are tracked as ADMIN-02.

Licensed under Apache-2.0.
