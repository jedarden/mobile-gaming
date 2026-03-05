# PWA Directory Submissions

This guide contains everything needed to submit Mobile Gaming to PWA directories.

## Target Directories

| Directory | URL | Status | Notes |
|-----------|-----|--------|-------|
| PWA.rocks | https://pwa.rocks/submit | Pending | High-traffic PWA showcase |
| AppScope | https://appscope.me/submit | Pending | PWA discovery platform |
| PWA Store | https://pwastore.com/submit | Pending | PWA marketplace |
| Store.app | https://store.app | Pending | PWA app store by PWA Builder |

## Quick Reference

**App URL:** https://mobile-gaming.pages.dev
**Manifest:** https://mobile-gaming.pages.dev/manifest.json
**Category:** Games / Puzzle
**Pricing:** Free

---

## Submission Details

### App Name
```
Mobile Gaming
```

### Short Description (50 chars max)
```
Browser puzzle games that deliver what the ads promised
```

### Medium Description (150 chars max)
```
Four satisfying puzzle games - Water Sort, Parking Escape, Bus Jam, Pull the Pin. No ads, no tracking, works offline. Play what the ads promised.
```

### Long Description (500 chars max)
```
Mobile Gaming delivers exactly what mobile game advertisements promise. 

Four complete puzzle games:
• Water Sort - Pour liquids to sort colors
• Parking Escape - Slide cars to unblock the exit
• Bus Jam - Match passengers to buses by color
• Pull the Pin - Remove pins to guide balls

Features:
✓ 100+ levels per game
✓ Infinite mode with procedural puzzles
✓ Progressive Web App (install on any device)
✓ Works offline
✓ Zero ads or tracking
✓ Free forever

Built as a PWA for instant access on desktop, mobile, and tablet. No app store required.
```

### Keywords/Tags
```
puzzle, games, casual, brain, offline, pwa, water-sort, parking, matching, logic
```

### Category
```
Games / Puzzle
```

### Developer/Creator Name
```
[Your Name/Organization]
```

### Contact Email
```
[Your Email]
```

### Website URL
```
https://mobile-gaming.pages.dev
```

### GitHub URL (if applicable)
```
https://github.com/[username]/mobile-gaming
```

---

## Required Assets

### App Icon (512x512 PNG)
Convert from: `public/icons/icon-512.svg`
```bash
rsvg-convert -w 512 -h 512 public/icons/icon-512.svg -o launch-assets/pwa-directories/icon-512.png
```

### Screenshots (3-5 required)

1. **Home Screen** - Game selection view
   - Source: `launch-assets/app-store-screenshots/iphone-screenshot-home.svg`
   
2. **Water Sort Gameplay** - Color sorting puzzle
   - Source: `launch-assets/gameplay-showcase/water-sort-showcase.svg`
   
3. **Parking Escape Gameplay** - Car sliding puzzle
   - Source: `launch-assets/gameplay-showcase/parking-escape-showcase.svg`
   
4. **Bus Jam Gameplay** - Color matching puzzle
   - Source: `launch-assets/gameplay-showcase/bus-jam-showcase.svg`
   
5. **Pull the Pin Gameplay** - Pin physics puzzle
   - Source: `launch-assets/gameplay-showcase/pull-the-pin-showcase.svg`

Convert all to PNG:
```bash
# Home screenshot
rsvg-convert -w 1290 -h 2796 launch-assets/app-store-screenshots/iphone-screenshot-home.svg -o launch-assets/pwa-directories/screenshot-home.png

# Gameplay screenshots
rsvg-convert -w 800 -h 600 launch-assets/gameplay-showcase/water-sort-showcase.svg -o launch-assets/pwa-directories/screenshot-water-sort.png
rsvg-convert -w 800 -h 600 launch-assets/gameplay-showcase/parking-escape-showcase.svg -o launch-assets/pwa-directories/screenshot-parking-escape.png
rsvg-convert -w 800 -h 600 launch-assets/gameplay-showcase/bus-jam-showcase.svg -o launch-assets/pwa-directories/screenshot-bus-jam.png
rsvg-convert -w 800 -h 600 launch-assets/gameplay-showcase/pull-the-pin-showcase.svg -o launch-assets/pwa-directories/screenshot-pull-the-pin.png
```

---

## Directory-Specific Instructions

### 1. PWA.rocks

**URL:** https://pwa.rocks/submit

**Requirements:**
- GitHub account required (submits via GitHub issue)
- App must be a valid PWA with manifest
- Must work offline or have offline capabilities

**Submission Process:**
1. Go to https://pwa.rocks/submit
2. Click "Submit a PWA" (opens GitHub issue)
3. Fill in the issue template:
   - Name: Mobile Gaming
   - URL: https://mobile-gaming.pages.dev
   - Description: (use Long Description above)
   - Category: Games
   - Screenshot URL: https://mobile-gaming.pages.dev/screenshots/home.svg

**Expected Response Time:** 1-2 weeks

---

### 2. AppScope

**URL:** https://appscope.me/

**Requirements:**
- Valid PWA manifest
- HTTPS required
- Responsive design

**Submission Process:**
1. Go to https://appscope.me/
2. Click "Submit App" or similar
3. Enter app URL: https://mobile-gaming.pages.dev
4. AppScope will auto-detect manifest details
5. Add additional info if needed:
   - Category: Games
   - Tags: puzzle, casual, offline

**Note:** AppScope may auto-index PWAs, so check if already listed first.

---

### 3. PWA Store (pwastore.com)

**URL:** https://pwastore.com/

**Requirements:**
- Valid manifest.json
- Service worker
- HTTPS

**Submission Process:**
1. Go to https://pwastore.com/submit (or equivalent)
2. Enter PWA URL: https://mobile-gaming.pages.dev
3. Upload icon (512x512)
4. Add description and category
5. Submit for review

---

### 4. Store.app (Microsoft PWA Builder)

**URL:** https://store.app

**Requirements:**
- Valid PWA manifest
- Service worker
- HTTPS

**Submission Process:**
1. Go to https://store.app
2. Click "Add your PWA"
3. Enter URL: https://mobile-gaming.pages.dev
4. PWA Builder will validate and suggest improvements
5. Publish to store

**Bonus:** This also packages for Microsoft Store.

---

## Post-Submission Checklist

- [ ] Submitted to PWA.rocks
- [ ] Submitted to AppScope
- [ ] Submitted to PWA Store
- [ ] Submitted to Store.app
- [ ] Verified listings appear correctly
- [ ] Responded to any feedback requests

## Tracking

After submission, track:
- Listing approval dates
- Traffic from each directory
- User reviews/ratings
- Featured status

---

*Created: 2026-03-05*
*Related Bead: mg-2y5.2*
