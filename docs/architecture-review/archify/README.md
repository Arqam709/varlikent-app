# Archify diagram specs

These JSON files are the sources for the architecture diagrams. Archify 3.0.1 turns each one into an interactive HTML page.

| Spec | Type | Repo root to pass | Output |
|---|---|---|---|
| `system-overview.json` | `architecture` | `../varlikent` | `../system-overview.html` |
| `frontend-architecture.json` | `architecture` | `../varlikent` | `../frontend-architecture.html` |
| `backend-architecture.json` | `architecture` | `../varlikent` | `../backend-architecture.html` |
| `database-architecture.json` | `architecture` | `../varlikent` | `../database-architecture.html` |
| `authentication-flow.json` | `sequence` | `../varlikent` | `../authentication-flow.html` |
| `chatbot-architecture.json` | `workflow` | `../varlikent` | `../chatbot-architecture.html` |
| `mobile-architecture.json` | `architecture` | `.` | `../mobile-architecture.html` |

All seven are rendered and pass Archify's four gates (validate, deliver, check, browser-check) as of 2026-10-08.

Repo roots are relative to the `varlikent-app` folder. Six specs cite the web/backend repository at commit `85c77be`; the mobile spec cites this repository at commit `71046f6`. Archify checks every cited file and line range against those commits, so the specs must be re-pinned if the code moves.

## Render one diagram

Run from the `varlikent-app` folder:

```bash
node ~/.agents/skills/archify/bin/archify.mjs finalize architecture \
  docs/architecture-review/archify/backend-architecture.json \
  docs/architecture-review/backend-architecture.html \
  --repo-root ../varlikent --quality showcase --json
```

Replace the type, the two file names and the repo root using the table. When replacing an existing HTML file, add `--out-dir <new folder>` so the new evidence does not collide with the old.

## Node.js version

Use Node 22.23 or newer, or Node 24.

Node 22.14.0 on this Windows machine cannot run any Archify command that writes a file. It reports device id `0` for path-based `stat` calls and the real id for handle-based ones, and Archify treats the mismatch as a file being swapped (`output/target-changed`, `finalize/receipt-publication`). Node 22.23.3 and 24.21.0 were tested here and work with unmodified Archify.

## Other files

- `previous/` holds the first render of the system overview and its spec, kept for reference. The current overview has a cleaner layout.
- `validate.sh <type> <name> <repo-root>` runs `archify validate` on one spec.
- `summarize.mjs` reads that JSON receipt on stdin and prints the diagnostics.
