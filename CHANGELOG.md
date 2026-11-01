# Changelog

All code packages in the dpdpkit release train share one version number.

## 0.1.0-alpha.1

### Added
- Screens: overview, request queue (assign, start, verify identity, respond, reject), consent analytics, retention
  monitor, incident register, audit export and read-only settings, all using the real API shapes.
- One screen failing to render no longer takes down the navigation or the other screens.
- The evidence pack download reports errors on screen instead of saving them as the file.
- End-to-end tests of every screen against the fastapi_shop example, WCAG 2.1 AA checks on every screen and a
  bundle size budget (60 kB gzip JS, 2 kB gzip CSS) in CI.
- Release workflow: on a `v*` tag, builds the dashboard and attaches `dpdpkit-admin-X.Y.Z.tar.gz`, its
  SHA-256 and an SBOM to the GitHub release for the adapter builds to consume.
- Repository scaffold: React 18 + Vite 8 + TypeScript app that builds to static files in `dist/` with relative
  asset URLs, and CI on Node 22 and 24.
