# Demo video pipeline

Build a local, reproducible 180-second film at 1920x1080, 30 fps (5,400 frames).

1. Inspect routes and authenticated sessions. Gate: planner account, reviewer Gmail, live parser and Instacart availability.
2. Reset the authorized household to two adults, two younger children, one required reviewer, and an empty week. Save the original state privately. Gate: independent API read matches the requested state.
3. Record real interactions with Playwright, privacy masking and cursor telemetry. Gate: all ten named clips, completed actions, persisted plan and approval.
4. Compose with Remotion and Lucide icons, timed captions, camera moves, browser/phone frames and ambient audio. Gate: sample frames and source typecheck.
5. Render and inspect. Gate: ffprobe verifies 5,400 video frames, 180 seconds, 1920x1080, 30 fps and audio; decode and inspect scene samples.

Only demo-video source is in scope. Existing package changes belong to the user. Auth, household backup, raw recordings and output media remain private local artifacts. No checkout or infrastructure changes.

Source findings: numbered nav links retain client state. Account state uses versioned PUT /api/household. Review settings use PUT /api/review/settings. Approval emails link to /r/token?action=approve, which approves on arrival. Default teen multiplier is 0.85; demo setup explicitly uses the requested 0.75.

## Progress

- Captured and independently probed all ten clips, totaling exactly 5,400 frames. Capture report and SHA-256 digests are in reports/capture.json.
- Real salmon parsing returned ten ingredients; seven dinner slots persisted. The current required reviewer approved through Gmail. Salt was excluded on camera.
- Instacart returned 27 shopping-list lines. All 27 selected ingredient rows resolve to 26 unique product IDs because fresh basil and Thai basil share a sandbox SKU. The cart contains all 26 unique products; no ingredient is missing. Live readback is in reports/store-gate.json and full mapping is in reports/instacart-reconciliation.json.
- GitHub is private and the saved browser profiles have no GitHub session. The outro therefore uses the explicitly labeled local README preview. Repository visibility was not changed.
- Claude Opus reviewed reliability. Added completed-scene checkpoints, Gmail reload and current-review validation, clip/telemetry integrity checks, exact sandbox host and cart assertions, and browser address labels driven by the real edit map.
- Privacy and timeline regression tests pass. All 65 application tests, application and compositor typechecks, ESLint and shell checks pass. Browser and phone layout samples have been inspected.
- Final full-resolution film is complete at family-meal-planner-demo.mp4 (37,677,350 bytes). Final build and verification passed: 1920x1080, 30 fps, 5,400 frames, video/audio/container exactly 180 seconds, standard yuv420p, complete decode, stereo-equivalent ambient gain -9.2 dB (35%). All scenes were visually inspected in the final contact sheet.
- Three demo regression tests pass, including shared SKU reconciliation and missing ingredient rejection. The independent live store gate also passes. The original complete capture was retained after a rejected retake exposed the incorrect one-ingredient/one-product assumption; clip and telemetry digests were reconciled before restoring it.
- Run `bash demo-video/build-video.sh --render-only` to repeat the render, `--finalize-only` to encode an existing Remotion render, or `--resume` to preserve completed recordings without another household reset or email send.
- The app TypeScript configuration excludes the independent demo project, whose own package manifest and compiler configuration keep video dependencies separate from the application.
- User selected the local README preview for the private repository. Existing root package.json and package-lock.json edits are user-owned and remain outside this change.
