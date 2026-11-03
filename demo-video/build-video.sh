#!/usr/bin/env bash
set -euo pipefail
DEMO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname -- "$DEMO_DIR")"
cd "$REPO_DIR"
DEMO_BIN="$DEMO_DIR/node_modules/.bin"
if [[ ! -x "$DEMO_BIN/remotion" ]]; then DEMO_BIN="$REPO_DIR/node_modules/.bin"; fi
mkdir -p "$DEMO_DIR/reports" "$DEMO_DIR/public/clips"
command -v ffmpeg >/dev/null
command -v ffprobe >/dev/null
test -f "$DEMO_DIR/public/audio/ambient-bg.mp3"
node --test "$DEMO_DIR/helpers.test.mjs"
if [[ "${1:-}" == "--resume" ]]; then
  node "$DEMO_DIR/record-clips.mjs" --resume
elif [[ "${1:-}" != "--render-only" && "${1:-}" != "--finalize-only" ]]; then
  node "$DEMO_DIR/reset-blank-plan.mjs"
  node "$DEMO_DIR/record-clips.mjs"
fi
node "$DEMO_DIR/verify.mjs" --clips-only
"$DEMO_BIN/tsc" --project "$DEMO_DIR/tsconfig.json"
BROWSER_BIN="$(node --input-type=module -e 'import {createRequire} from "node:module"; process.stdout.write(createRequire(process.argv[1])("playwright").chromium.executablePath())' "$DEMO_DIR/package.json")"
if [[ "${1:-}" != "--finalize-only" ]]; then
  "$DEMO_BIN/remotion" render "$DEMO_DIR/src/index.tsx" FamilyMealPlannerDemo "$DEMO_DIR/reports/remotion-render.mp4" \
  --public-dir "$DEMO_DIR/public" --browser-executable "$BROWSER_BIN" --codec h264 --crf 18 --pixel-format yuv420p --concurrency 8 --log error
fi
ffmpeg -y -v error -i "$DEMO_DIR/reports/remotion-render.mp4" \
  -vf 'scale=in_range=auto:out_range=tv' -color_range tv -pix_fmt yuv420p \
  -r 30 -frames:v 5400 -c:v libx264 -preset fast -crf 18 \
  -af 'atrim=duration=180' -c:a aac -b:a 192k -t 180 -movflags +faststart \
  "$DEMO_DIR/family-meal-planner-demo.mp4"
node "$DEMO_DIR/verify.mjs"
