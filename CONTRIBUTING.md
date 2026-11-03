# Contributing

1. Branch from `main` and open a pull request.
2. Run the CI gate locally before pushing: `npm ci --ignore-scripts && npm run lint && npm run typecheck && npm test && npm run build`.
3. Use short, imperative commit messages (Conventional Commits prefixes welcome).
4. Add a line under `## [Unreleased]` in `CHANGELOG.md` for any user-visible change.

## Releasing (maintainer)

1. Move `[Unreleased]` entries to a new `## [X.Y.Z] - YYYY-MM-DD` section and set `version` in `package.json` to `X.Y.Z`.
2. Merge to `main` after CI passes.
3. `git tag vX.Y.Z && git push origin vX.Y.Z`. The Release workflow verifies the tag, publishes `ghcr.io/jaccrocker/family-meal-planner-public:X.Y.Z` with provenance, and creates the GitHub Release. Use `vX.Y.Z-rc.N` for a prerelease.
