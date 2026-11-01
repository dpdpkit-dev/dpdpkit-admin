# Changelog

All code packages in the dpdpkit release train share one version number.

## Unreleased

### Added
- Release workflow: on a `v*` tag, builds the dashboard and attaches `dpdpkit-admin-X.Y.Z.tar.gz`, its
  SHA-256 and an SBOM to the GitHub release for the fastapi, django and server builds to consume.
- Repository scaffold: React 18 + Vite 8 + TypeScript app that builds to static files in `dist/` with relative
  asset URLs, a placeholder shell, a unit test and CI on Node 22 and 24.
