# Launch FAQ

## General Questions

### What is Mobile Gaming?

Mobile Gaming is a collection of browser-based puzzle games that deliver exactly what mobile game advertisements show. It includes four games: Water Sort, Parking Escape, Bus Jam, and Pull the Pin.

### Why did you build this?

After years of seeing mobile game ads that showed satisfying puzzle gameplay but delivered completely different games (usually match-3 clones with aggressive monetization), I decided to build what the ads promised. The "bait-and-switch" has become normalized in mobile gaming, and Mobile Gaming is a response to that.

### Is it really free?

Yes, completely free. No ads, no microtransactions, no premium version, no energy systems. Just puzzles.

### How do you make money?

Mobile Gaming is a passion project, not a business. There are no plans to monetize it. The goal is to demonstrate that engaging games don't need exploitative monetization.

## Technical Questions

### What devices does it work on?

Mobile Gaming works on any device with a modern web browser:
- Desktop (Chrome, Firefox, Safari, Edge)
- Mobile (iOS Safari, Android Chrome)
- Tablet (iPad, Android tablets)

### Do I need to download anything?

No download required! Just visit mobile-gaming.pages.dev in your browser. However, you can install it as a Progressive Web App (PWA) for:
- Offline play
- Home screen icon
- Full-screen experience

### How do I install it as an app?

**iOS (Safari):**
1. Visit mobile-gaming.pages.dev
2. Tap the Share button
3. Tap "Add to Home Screen"

**Android (Chrome):**
1. Visit mobile-gaming.pages.dev
2. Tap the menu (three dots)
3. Tap "Add to Home Screen" or "Install app"

**Desktop (Chrome/Edge):**
1. Visit mobile-gaming.pages.dev
2. Click the install icon in the address bar
3. Click "Install"

### Does it work offline?

Yes! Once you've visited the site, the game caches automatically. After that, you can play offline.

### Is my progress saved?

Progress is saved locally in your browser. It persists between sessions but doesn't sync across devices. (Cross-device sync may be added in the future.)

### What technology is it built with?

- Vanilla JavaScript (no frameworks)
- Canvas API for game rendering
- CSS Custom Properties for theming
- Service Worker for offline support
- Vite for building

### Is it open source?

[Yes/No - update based on actual status]

## Game Questions

### What games are included?

1. **Water Sort** - Pour colored liquids between tubes to sort them
2. **Parking Escape** - Slide cars to unblock the exit (Rush Hour style)
3. **Bus Jam** - Match color-coded passengers to buses
4. **Pull the Pin** - Remove pins in the right order to guide balls

### How many levels are there?

Each game has 100+ handcrafted levels, plus an "Infinite Mode" with procedurally generated puzzles for endless play.

### What's the difficulty like?

Levels start easy and progressively increase in difficulty. Early levels teach mechanics, later levels require strategic thinking. Infinite mode offers unlimited challenges.

### Can I undo moves?

Yes! All games include an undo feature. Made a mistake? Just tap undo and try again.

### Is there a timer?

No timers in the main game modes. Play at your own pace. There is a "Zen Mode" option for an even more relaxed experience.

### Can I share my solutions?

Yes! Water Sort includes a GIF export feature. Complete a level and export your solution as an animated GIF to share.

## Privacy Questions

### Do you collect my data?

Mobile Gaming uses minimal local storage for:
- Game progress
- Settings preferences

No personal data is collected or transmitted. No accounts, no tracking, no analytics beyond basic page views.

### Are there ads?

Zero ads. No banner ads, no video ads, no rewarded ads, no "watch ad to continue." None.

### Do you use cookies?

Only essential cookies for site functionality. No tracking cookies, no third-party cookies.

## Future Plans

### Will you add more games?

Possibly! If there's interest, additional puzzle types may be added. Suggestions welcome.

### Will you add multiplayer?

No current plans for multiplayer. The focus is on single-player puzzle satisfaction.

### Will you add leaderboards?

Maybe. If added, they would be optional and privacy-respecting.

### How can I give feedback?

[Contact method - email, Twitter, GitHub issues, etc.]

## Troubleshooting

### The game isn't loading

Try:
1. Refreshing the page
2. Clearing browser cache
3. Using a different browser
4. Checking your internet connection (first load requires connection)

### My progress was lost

Progress is stored locally. It can be lost if you:
- Clear browser data
- Use private/incognito mode
- Switch browsers or devices

### The game is laggy

Try:
1. Closing other tabs/apps
2. Using a newer browser version
3. Reducing motion in accessibility settings

### I found a bug

Please report it at [GitHub issues link] with:
- Device and browser
- What happened
- What you expected to happen
- Steps to reproduce
