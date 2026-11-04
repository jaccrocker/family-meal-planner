# Changelog

All notable changes are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Dependabot version updates for npm, grouped monthly, minor and patch only.
- Ruleset on `main`: pull request with review and passing CI required, force push and deletion blocked.
- JSDoc across `src/lib`, API routes and components; expanded API route docs.
- README status badges, roadmap and embedded demo video.

### Changed
- React and React DOM to 19.3.1; nodemailer to 10.3.1; openai to 7.47.0; SHA-pinned actions refreshed.
- Workflow `GITHUB_TOKEN` scoped to the permissions each job needs.

### Security
- Override `minimatch` to 11.x under typescript-estree (GHSA-g3hv-75wg-m249) and `uuid` to 11.x under exceljs (GHSA-w5hq-g745-h8pq); `npm audit` reports 0.
- Demo capture accounts and the app host moved out of the repo and purged from history.

## [0.1.0] - 2026-11-02

First public release.

### Added
- Quantity engine, family meal library and drafted amounts, with a script that loads reviewed amounts from the review workbook.
- Planner pages, Google sign in, meal parser, Instacart list handoff and demo mode.
- Household approval step with email, reminders and auto approve; up to 10 adults; auto advance to the next open day.
- Google Calendar, Alexa and Skylight integrations behind feature flags.
- Landing page and a phone-friendly planner.
- Homelab deploy pipeline with verified rollout, running only after CI passes on `main`.

### Changed
- Sessions are keyed by Google account id; existing households are kept.
- Repository references sanitized for public release; host addresses come from repository settings.

### Fixed
- Instacart measurement priority and counted multipacks; realistic pack sizes for typed meals.
