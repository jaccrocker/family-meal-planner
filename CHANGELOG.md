# Changelog

All notable changes are recorded here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
