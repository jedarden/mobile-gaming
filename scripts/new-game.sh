#!/bin/bash
#
# new-game.sh - Game Scaffold Generator
#
# Creates a new game directory with all required files
# Usage: ./scripts/new-game.sh <game-id> <game-name>
#
# Example:
#   ./scripts/new-game.sh water-sort "Water Sort"
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check arguments
if [ $# -lt 2 ]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: $0 <game-id> <game-name>"
    echo "Example: $0 water-sort \"Water Sort\""
    exit 1
fi

GAME_ID=$1
GAME_NAME=$2
GAME_DIR="src/games/${GAME_ID}"

# Validate game-id format (lowercase, hyphens only)
if [[ ! $GAME_ID =~ ^[a-z]+(-[a-z]+)*$ ]]; then
    echo -e "${RED}Error: game-id must be lowercase with hyphens (e.g., water-sort)${NC}"
    exit 1
fi

# Check if game already exists
if [ -d "$GAME_DIR" ]; then
    echo -e "${RED}Error: Game directory already exists: $GAME_DIR${NC}"
    exit 1
fi

echo -e "${BLUE}Creating new game: ${GAME_NAME} (${GAME_ID})${NC}"

# Create directory structure
mkdir -p "$GAME_DIR"

# Create index.html
cat > "$GAME_DIR/index.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${GAME_NAME} | Mobile Gaming</title>
  <link rel="stylesheet" href="../../styles/reset.css">
  <link rel="stylesheet" href="../../styles/variables.css">
  <link rel="stylesheet" href="../../styles/game-shell.css">
  <link rel="stylesheet" href="../../styles/components.css">
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div class="game-container">
    <header class="game-header">
      <a href="../../" class="back-link">← Back</a>
      <h1>${GAME_NAME}</h1>
      <div class="game-header-controls">
        <button class="icon-btn" id="btn-sound" title="Toggle Sound">🔊</button>
        <button class="icon-btn" id="btn-settings" title="Settings">⚙️</button>
      </div>
    </header>

    <div class="game-stats">
      <div class="game-stat">
        <span class="game-stat-value" id="stat-level">1</span>
        <span class="game-stat-label">Level</span>
      </div>
      <div class="game-stat">
        <span class="game-stat-value" id="stat-moves">0</span>
        <span class="game-stat-label">Moves</span>
      </div>
      <div class="game-stat">
        <span class="game-stat-value" id="stat-time">0:00</span>
        <span class="game-stat-label">Time</span>
      </div>
    </div>

    <div class="game-board" id="game-board">
      <!-- Game canvas/content renders here -->
      <p>Game board for ${GAME_NAME}</p>
    </div>

    <div class="game-controls">
      <button class="game-btn game-btn-secondary" id="btn-undo">↩ Undo</button>
      <button class="game-btn game-btn-primary" id="btn-restart">↻ Restart</button>
      <button class="game-btn game-btn-secondary" id="btn-hint">💡 Hint</button>
    </div>
  </div>

  <script type="module" src="./game.js"></script>
</body>
</html>
EOF

# Create game.js
cat > "$GAME_DIR/game.js" << 'EOF'
/**
 * Game Logic for ${GAME_NAME}
 *
 * TODO: Implement game mechanics
 */

import { History } from '../../shared/history.js';
import { Storage } from '../../shared/storage.js';
import { Audio } from '../../shared/audio.js';
import { createRNG } from '../../shared/rng.js';

class Game {
  constructor() {
    this.level = 1;
    this.moves = 0;
    this.time = 0;
    this.history = new History();
    this.timer = null;

    this.init();
  }

  init() {
    // Load saved progress
    const saved = Storage.get('${GAME_ID}-progress', { level: 1 });
    this.level = saved.level;

    // Bind controls
    document.getElementById('btn-undo').addEventListener('click', () => this.undo());
    document.getElementById('btn-restart').addEventListener('click', () => this.restart());
    document.getElementById('btn-hint').addEventListener('click', () => this.showHint());

    // Start game
    this.startLevel(this.level);
  }

  startLevel(level) {
    this.level = level;
    this.moves = 0;
    this.time = 0;
    this.history.clear();
    this.updateStats();
    this.startTimer();

    // Generate puzzle using seeded RNG for daily challenges
    // const rng = createRNG(seed);
    // TODO: Generate puzzle
  }

  startTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.time++;
      this.updateStats();
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  updateStats() {
    document.getElementById('stat-level').textContent = this.level;
    document.getElementById('stat-moves').textContent = this.moves;
    const mins = Math.floor(this.time / 60);
    const secs = this.time % 60;
    document.getElementById('stat-time').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  undo() {
    const state = this.history.undo();
    if (state) {
      // TODO: Restore state
      Audio.play('click');
    }
  }

  restart() {
    this.startLevel(this.level);
    Audio.play('click');
  }

  showHint() {
    // TODO: Implement hint system
    console.log('Hint requested');
  }

  win() {
    this.stopTimer();
    Audio.play('win');

    // Save progress
    Storage.set('${GAME_ID}-progress', { level: this.level + 1 });

    // TODO: Show win overlay
  }
}

// Start game
new Game();
EOF

# Replace placeholder in game.js
sed -i "s/\${GAME_ID}/${GAME_ID}/g" "$GAME_DIR/game.js"
sed -i "s/\${GAME_NAME}/${GAME_NAME}/g" "$GAME_DIR/game.js"

# Create styles.css
cat > "$GAME_DIR/styles.css" << EOF
/**
 * ${GAME_NAME} - Game-specific Styles
 */

/* Game board specific styles */
#game-board {
  /* Add game-specific board styles */
}

/* Add game-specific component styles below */
EOF

# Remove .gitkeep if it exists
rm -f "$GAME_DIR/.gitkeep"

echo -e "${GREEN}✓ Created game scaffold at $GAME_DIR${NC}"
echo ""
echo "Files created:"
echo "  - $GAME_DIR/index.html"
echo "  - $GAME_DIR/game.js"
echo "  - $GAME_DIR/styles.css"
echo ""
echo "Next steps:"
echo "  1. Implement game logic in $GAME_DIR/game.js"
echo "  2. Add game-specific styles in $GAME_DIR/styles.css"
echo "  3. Add audio assets to public/audio/sfx/"
echo "  4. Update src/index.html to include game in directory"
