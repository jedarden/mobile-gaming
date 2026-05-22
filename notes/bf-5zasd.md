# Bead bf-5zasd: CI lint fix

## Work Completed

Fixed `.github/workflows/ci.yml` validation to match the actual codebase structure:

- **Replaced main.js with game.js** - All 13 games use `game.js` as their main module, not `main.js`
- **Removed README.md from required files** - Only bus-jam has a README; documentation should be optional
- **Removed generator.js from required files** - Not all games need procedural level generation (e.g., brain-teaser and save-the-character are hand-crafted)

## Changes Made

File: `.github/workflows/ci.yml`
- Changed required files from: `index.html main.js state.js renderer.js input.js styles.css levels.json generator.js README.md`
- To: `index.html game.js state.js renderer.js input.js styles.css levels.json`

## Commit

```
commit 7ee94aa
fix(ci): align required files with actual codebase structure

- Replace main.js with game.js (all games use game.js as main module)
- Remove README.md from required files (optional documentation)
- Remove generator.js from required files (not all games need procedural generation)
```

## Bead System Issue

The bead system encountered a FOREIGN KEY constraint error when attempting to close. The `br doctor --repair` command was run, which repaired the database (imported 475 beads from JSONL), but subsequent close attempts failed with:
- "Invalid claimed_at format: premature end of input"
- "FOREIGN KEY constraint failed"

The work itself is complete and committed. The bead tracking system may need manual reconciliation.
