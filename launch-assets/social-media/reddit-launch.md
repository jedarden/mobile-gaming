# Reddit Launch Posts

## r/webgames

**Title:** [Browser Game] Mobile Gaming - Puzzle games that actually match the ads (Water Sort, Parking Escape, Bus Jam, Pull the Pin)

**Body:**
Hey r/webgames!

I built Mobile Gaming after one too many experiences with mobile game ads that showed one thing and delivered another.

**What it is:**
Four browser-based puzzle games inspired by those viral mobile game ads:
- 💧 **Water Sort** - Pour colored liquids between tubes to sort them
- 🚗 **Parking Escape** - Slide cars to clear the exit (classic unblock puzzle)
- 🚌 **Bus Jam** - Match passengers by color to fill buses
- 📌 **Pull the Pin** - Remove pins in the right order to guide balls

**Features:**
- Progressive Web App (works offline, installable)
- 100+ levels per game
- Touch and mouse support
- No ads, no tracking, no paywalls
- Works on desktop, mobile, tablet

**Play here:** mobile-gaming.pages.dev

**Tech stack:** Vanilla JS, Canvas API, CSS, Vite. No frameworks needed for smooth 60fps gameplay.

Happy to answer questions about the development or take feedback on the games!

---

## r/IndieGaming

**Title:** After seeing too many fake mobile game ads, I built what they promised - Mobile Gaming (4 puzzle games, free, browser-based)

**Body:**
Hey everyone!

You know those mobile game ads that show satisfying puzzle gameplay, but when you download the game it's completely different? I got tired of that.

So I built Mobile Gaming - four puzzle games that deliver exactly what the ads show:

- **Water Sort** - The liquid pouring puzzle
- **Parking Escape** - Unblock the car sliding puzzle
- **Bus Jam** - Color-matching passenger sorting
- **Pull the Pin** - Physics-based pin removal

**Why browser-based?**
- No app store approval needed
- Works on any device with a browser
- Can be installed as a PWA for offline play
- Instant access - just open the link

**No monetization scheme:**
- No ads
- No microtransactions
- No energy systems
- No daily limits
- Just... puzzles

**Play free:** mobile-gaming.pages.dev

Built this because I genuinely enjoy these puzzle types and wanted them without all the mobile gaming baggage. Hope you enjoy it too!

Feedback welcome!

---

## r/puzzles

**Title:** I made a collection of satisfying puzzle games (Water Sort, Unblock, Color Match, Pin Pull) - free, no ads

**Body:**
Hi puzzle lovers!

I created Mobile Gaming - a collection of browser-based puzzle games inspired by those satisfying puzzle ads we've all seen.

**The Games:**

💧 **Water Sort**
- Pour colored liquids between tubes
- Goal: Sort all colors into separate tubes
- 100+ levels from easy to fiendish

🚗 **Parking Escape**
- Classic sliding block puzzle (Rush Hour style)
- Slide cars to free the exit
- Multiple car sizes and orientations

🚌 **Bus Jam**
- Passengers wait in lines, color-coded
- Load matching colors onto buses
- Strategic planning required!

📌 **Pull the Pin**
- Remove pins to guide balls
- Physics-based puzzles
- Timing and order matter

**Why you might like it:**
- No ads interrupting your thinking
- No energy systems limiting play
- Undo feature for experimentation
- Progress saves automatically
- Works offline once loaded

**Play:** mobile-gaming.pages.dev

What puzzle types do you enjoy? I'm considering adding more!

---

## r/InternetIsBeautiful

**Title:** Someone finally made the games from those mobile ads - and they're actually good

**Body:**
mobile-gaming.pages.dev

You know those mobile game ads with satisfying puzzles that are never actually in the game? Someone built them for real.

Four games, all playable in browser:
- Water sort puzzle
- Car unblock puzzle
- Bus passenger sorting
- Pin pull physics

No ads, no download, no catch. Just... the puzzles from the ads.

---

## r/programming

**Title:** Show HN/Reddit: I built browser puzzle games with vanilla JS and Canvas - Mobile Gaming

**Body:**
Hey r/programming!

I built Mobile Gaming - a collection of puzzle games that run entirely in the browser with smooth 60fps animations.

**Tech highlights:**

- **Canvas rendering** - All game graphics rendered via Canvas API with optimized draw calls
- **State management** - Simple but effective state machines for each game type
- **PWA** - Service worker for offline capability, web manifest for installability
- **Responsive** - Dynamic canvas sizing with device pixel ratio handling
- **GIF Export** - Built custom LZW encoder for solution sharing (see src/shared/gif-export.js)
- **Level generation** - Procedural generators for infinite replayability
- **Solver** - BFS-based solver for Water Sort level validation

**Architecture:**
```
src/
├── games/
│   ├── water-sort/
│   ├── parking-escape/
│   ├── bus-jam/
│   └── pull-the-pin/
├── shared/          # Common utilities
└── styles/          # CSS custom properties
```

Each game has:
- `game.js` - Game logic and state machine
- `renderer.js` - Canvas drawing
- `state.js` - State management
- `levels.json` - Handcrafted levels

**Play:** mobile-gaming.pages.dev
**Code:** github.com/[repo]

Happy to discuss the technical decisions or take feedback!
