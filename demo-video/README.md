# Family Meal Planner film

Run `bash demo-video/build-video.sh` from the repository. It resets the authorized household, records the real account workflow and reviewer Gmail approval, renders locally, and verifies the output. Use `bash demo-video/build-video.sh --resume` to continue a checkpoint without resetting or resending email, or `bash demo-video/build-video.sh --render-only` to reuse verified captures.

Use `--finalize-only` to finish a saved `reports/remotion-render.mp4` without rendering it again. Final encoding converts full-range screenshots to standard limited-range H.264, preserves exactly 5,400 frames, and trims the audio and container to exactly 180 seconds. Audio gain is checked after converting both signals to the same channel layout.

Dependencies already installed at the repository root are reused. On a clean checkout, install the isolated toolchain with `npm --prefix demo-video install`. FFmpeg and an installed Playwright Chromium browser are prerequisites. The app's TypeScript configuration excludes this independent video project; its own configuration is checked by the build script.

The result is `demo-video/family-meal-planner-demo.mp4`, 1920x1080, 30 fps, 180 seconds, 5,400 frames. Ten clips represent the eight scenes, including the three approval shots. Music is the existing `public/audio/ambient-bg.mp3` at 35% volume. No voiceover, TTS, paid rendering, API credentials or checkout actions are introduced.

## Files

- `helpers.mjs`: init-script privacy masking, pointer, ripple, camera telemetry and smooth interactions.
- `reset-blank-plan.mjs`: owner identity check, private backup, exact household reset, independent API reconciliation.
- `record-clips.mjs`: separate planner/reviewer/mobile contexts, real UI interactions, live parser, Gmail approval and Instacart sandbox.
- `scenes.mjs`: authoritative timeline and expected clip census.
- `src/`: Remotion composition and Lucide overlays.
- `verify.mjs`: independent clip census, frame counts, workflow assertions, final media probe and full decode.
- `helpers.test.mjs`: privacy and timing regression gates.
- `reports/`: local capture and verification evidence.

Authenticated sessions live under `auth/`. Household backups, persistent Chrome profiles, email approval tokens, raw recordings and generated media stay local and must never be committed. Raw recordings can include loading frames outside the exported scene ranges. The shared privacy init script is applied to all contexts, including new pages.

The film uses the numbered in-app step links to retain client state. Long model response waits are shortened during editing; real typing and UI actions remain in the capture. A newly created Instacart shopping list is opened without placing or paying for an order.

Only the owner's existing Cloudflare gateway cookie is shared with the reviewer context; the Google accounts stay separate. The Instacart segment adds products to a sandbox guest cart, then returns to the list to show the filled cart badge. Sign-in and checkout stay with the shopper.

The repository is currently private. If GitHub returns 404, the outro uses a clearly labeled local README preview, served only on 127.0.0.1, with the source file's diagrams summarized visually. An authenticated GitHub page is used when available. The final browser address label reports the actual source.

Each completed scene writes a raw-recording checkpoint. Final clip and telemetry SHA-256 digests bind verification to a single completed capture, preventing old and new files from passing as one run.

Store reconciliation compares every requested ingredient with its selected product row and product ID, then checks the unique product count against the cart. In the captured week, 27 ingredient lines resolve to 26 unique products because fresh basil and Thai basil share one sandbox product. No ingredient line is missing; the shopper still reviews the matched varieties before checkout.

Remotion references: [local rendering](https://www.remotion.dev/docs/render), [frame-safe video](https://www.remotion.dev/docs/offthreadvideo).
