<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Removing sensitive data

A scrub is not done until it rewrites history and a scan of every branch, tag and PR ref finds 0 commits containing the values. Removing values from the current files, or force-pushing a fix on top, leaves them in every earlier commit (11/4/26: two demo accounts and the app URL survived in 37 commits after such a scrub).

- Rewrite with `git filter-repo --replace-text` (add `--replace-message` when commit messages hold the values). It skips binary files, so drop any binary that holds them with `--path <file> --invert-paths`.
- Before force-pushing, scan every commit reachable from every branch and tag (`git rev-list --all`, then `git grep -F` per commit) and require 0 hits.
- GitHub keeps `refs/pull/*` and cached commit pages after a rewrite; only GitHub Support can purge them, so file that request as part of the scrub.
