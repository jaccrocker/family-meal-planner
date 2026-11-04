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
- A reliability review added completed-scene checkpoints, Gmail reload and current-review validation, clip/telemetry integrity checks, exact sandbox host and cart assertions, and browser address labels driven by the real edit map.
- Privacy and timeline regression tests pass. All 65 application tests, application and compositor typechecks, ESLint and shell checks pass. Browser and phone layout samples have been inspected.
- Final full-resolution film is complete at family-meal-planner-demo.mp4 (37,677,350 bytes). Final build and verification passed: 1920x1080, 30 fps, 5,400 frames, video/audio/container exactly 180 seconds, standard yuv420p, complete decode, stereo-equivalent ambient gain -9.2 dB (35%). All scenes were visually inspected in the final contact sheet.
- Three demo regression tests pass, including shared SKU reconciliation and missing ingredient rejection. The independent live store gate also passes. The original complete capture was retained after a rejected retake exposed the incorrect one-ingredient/one-product assumption; clip and telemetry digests were reconciled before restoring it.
- Run `bash demo-video/build-video.sh --render-only` to repeat the render, `--finalize-only` to encode an existing Remotion render, or `--resume` to preserve completed recordings without another household reset or email send.
- The app TypeScript configuration excludes the independent demo project, whose own package manifest and compiler configuration keep video dependencies separate from the application.
- User selected the local README preview for the private repository. Existing root package.json and package-lock.json edits are user-owned and remain outside this change.

## Alternative requested on November 2, 2026

- Keep the original movie and all existing text overlays. Save a separate alternative using the file-versioning skill in this folder.
- Show only the workflow's relevant email. The alternative omits the inbox list and crops the reading pane; source-frame 105 is held over the hidden mailbox-opening action. The audited source clip is pinned by SHA-256, with a two-frame transition guard.
- Zoom out before every interaction, hold a full view through the click and response, then return to detail. Five demo tests pass, including the camera invariant for every recorded event and file-version rollover.
- Three 30-second, versioned audiovisual music samples are complete and reconciled against the three distinct licensed sources. Music options and credits are in Meal Planning Music Options 20261102a.md. User selected Life of Riley by Kevin MacLeod.
- Full alternative rendered successfully as Family Meal Planner Alternative 20261102a.mp4: 180 seconds, 5,400 frames, 1920x1080, 30 fps, stereo audio exactly 180 seconds at -9.2 dB relative to the normalized bed (35% volume), 43,251,101 bytes. Full decode, email-only framing, click context and original checksum gates passed. Metadata: reports/alternative-verification.json.
- A silent 13-second privacy preview is complete at Family Meal Planner Alternative Preview 20261102a.mp4. Original movie checksum remains unchanged.
- Final visual QA found and corrected a Chrome backdrop-paint tile on the email scene's caption background. The alternative keeps the same glass tint but disables backdrop filtering. Only frames 2610 to 2999 were re-rendered, then combined with version a's remaining scenes and unchanged music.
- Final delivery is Family Meal Planner Alternative 20261102b.mp4 (41,578,173 bytes), with matching versioned music-credit report. It passes 1920x1080, 30 fps, 5,400 frames, video/audio/container exactly 180 seconds, yuv420p, full decode, five demo tests, typecheck and lint. Email-only and full-context click frames were visually checked. Original movie and alternative version a are both preserved. Final metadata: reports/alternative-verification.json.

## Confidential recreation requested on November 2, 2026

- In progress. New isolated capture: public/clips/confidential-20261102, private reports: reports/confidential-20261102. Prior source clips and all finished movies are preserved.
- Display alias is Jac C throughout. Address input stays blurred from the first character. Gmail records start in the relevant open message, and the compositor omits the surrounding mailbox interface for both accounts.
- Reset independently verified one adult, no other adults and no reviewer. Capture must add the authorized partner on camera, increase adults to two, send a real approval email, approve from partner Gmail, and show the confirmation back in planner Gmail.
- Saved persistent planner Gmail uses the newer Ask Gmail search label. Both mailbox sessions were verified against their expected accounts. Auth exports remain local and ignored.
- Six regression tests and the compositor typecheck are the source gates. Final gate additionally requires all ten clips, live workflow assertions, sample-frame privacy inspection, OCR name scan, exact 180-second media metadata, complete decode, preserved original SHA-256, and versioned delivery with Pushover notification.
- Root package.json and package-lock.json remain user-owned and excluded from the commit.
- Gmail-specific findings: conversation threads can show an old expanded body while the newest approval email is hidden as trimmed content. The capture now filters to this run's send time, opens the newest message, expands its trimmed body and hides prior thread messages before selecting footage.
- Gmail enforces Trusted Types. The cursor now uses DOM SVG construction rather than an HTML assignment, so privacy masking can install on the live Gmail page. A dedicated protected-document regression test passes. Seven demo tests and the compositor typecheck now pass.
- First three scenes were saved in the completed checkpoint before the email correction. Recording resumed from the send step, retaining the actual solo setup and collaborator addition without another full retake.
- Capture is complete. All ten clips reconcile to 5,400 frames. Real workflow checks passed: solo start, on-camera member addition, seven saved dinners, planner Sent message, partner email approval, planner's received confirmation, approved status, pantry exclusion and a fully reconciled sandbox cart.
- Source contact sheet inspected. Jac C appears in setup, the email preview and the actual messages. The final reading-pane crop also excludes the sender's profile photo, mailbox lists, labels and account controls. A two-frame crop guard covers cuts into and out of Gmail.
- Initial OCR census passed all 400 expected samples, with zero full-name matches and 262 alias matches. A repeat is running against the final reading-pane crop before the full render. Final render command is recorded in README.md; session log is reports/confidential-render.log.
- Final crop OCR repeated successfully: 400/400 expected frames, zero full-name matches and 262 Jac C matches. Independent capture verification also passed the dynamic 26 ingredient lines, 25 unique selected products and zero missing ingredients.
- Inspected full-resolution composed setup, partner email and planner confirmation frames. They retain the accepted design and captions, show Jac C, omit profile photos and mailbox controls, and preserve the complete approval button. Full render is in progress, followed by exact-duration/audio checks and complete decode.
- Version c rendered and passed full decode, exact 180-second video/audio/container timing, 5,400 frames, stereo sound and -9.2 dB music gain (35%). Final contact sheet inspected. Original and prior alternatives are preserved.
- Final inspection found an identifying GitHub handle in the source-shot browser address. The approved local README preview now replaces that shot. A dedicated finalizer re-renders only the final ten seconds and retains the verified first 170 seconds and complete soundtrack, saving the next version. Future confidential recordings choose the local preview directly.
- Final delivery is Family Meal Planner Alternative 20261102d.mp4. The local README frame was visually inspected and passed OCR for both the full name and identifying handle. Finalizer gates passed: 1920x1080, 30 fps, 5,400 frames, exactly 180 seconds for video/audio/container, full decode, unchanged soundtrack bytes and preserved original SHA-256. Version c remains as a prior local revision. Matching version d report includes music attribution and verification details.
