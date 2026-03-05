# Launch Announcement Assets

This directory contains all assets for the Mobile Gaming launch announcement.

## Directory Structure

```
launch-assets/
├── social-media/           # Social media post templates
│   ├── twitter-launch.md   # Twitter/X posts and threads
│   ├── linkedin-launch.md  # LinkedIn professional posts
│   ├── reddit-launch.md    # Reddit posts for various subreddits
│   └── product-hunt.md     # Product Hunt launch guide
│
├── gameplay-showcase/      # SVG game showcase images
│   ├── water-sort-showcase.svg
│   ├── parking-escape-showcase.svg
│   ├── bus-jam-showcase.svg
│   └── pull-the-pin-showcase.svg
│
├── app-store-screenshots/  # PWA store screenshots
│   ├── iphone-screenshot-home.svg
│   ├── iphone-screenshot-gameplay.svg
│   └── README.md           # Screenshot conversion guide
│
└── press-kit/              # Press materials
    ├── press-kit.md        # Full press kit
    ├── brand-guidelines.md # Brand colors, fonts, usage
    └── faq.md              # Launch FAQ
```

## Quick Start

### Social Media Launch

1. **Twitter/X** - Use `social-media/twitter-launch.md`
   - Main launch tweet
   - Thread follow-ups
   - Short and hashtag variations

2. **LinkedIn** - Use `social-media/linkedin-launch.md`
   - Professional announcement
   - Story version

3. **Reddit** - Use `social-media/reddit-launch.md`
   - r/webgames, r/IndieGaming, r/puzzles, r/programming posts

4. **Product Hunt** - Use `social-media/product-hunt.md`
   - Taglines, descriptions
   - Maker comment
   - Launch timing tips

### Screenshots for App Stores

Convert SVG to PNG using the guide in `app-store-screenshots/README.md`:

```bash
# Quick conversion
rsvg-convert -w 1290 -h 2796 iphone-screenshot-home.svg -o screenshot.png
```

### Press Kit

Share `press-kit/press-kit.md` with journalists and reviewers.

## Asset Overview

### Brand Colors
- **Primary:** `#6366f1` (Indigo)
- **Secondary:** `#8b5cf6` (Purple)
- **Accent:** `#00d4ff` → `#ff6b6b` (Cyan to Coral)
- **Background:** `#0f0f23` → `#1a1a2e` (Dark gradient)

### Taglines
- "Play the games the ads promised"
- "Browser puzzle games that deliver"
- "No ads. No tracking. Just puzzles."

### Key Features to Highlight
1. Four complete puzzle games
2. 100+ levels per game
3. Progressive Web App (offline capable)
4. Zero ads or tracking
5. Free forever
6. Cross-platform (desktop, mobile, tablet)

## Launch Checklist

- [ ] Review all social media posts
- [ ] Convert screenshots to PNG
- [ ] Test PWA installation on devices
- [ ] Prepare Product Hunt launch
- [ ] Schedule launch time (Tuesday-Thursday, 12:01 AM PST)
- [ ] Have maker friends ready for initial upvotes
- [ ] Cross-post to subreddits
- [ ] Share on Twitter/LinkedIn
- [ ] Respond to all comments
- [ ] Monitor for feedback

## Converting SVG to PNG/GIF

### Using ImageMagick
```bash
convert showcase.svg showcase.png
```

### Using rsvg-convert (recommended)
```bash
# Install
sudo apt install librsvg2-bin

# Convert
rsvg-convert -w 800 -h 600 showcase.svg -o showcase.png
```

### Creating GIFs from SVG animations
The SVG showcases include CSS animations. To create actual GIFs:

1. Open SVG in browser
2. Use screen recording software
3. Convert to GIF using:
   ```bash
   ffmpeg -i recording.mp4 -vf "fps=10,scale=800:-1" output.gif
   ```

Or use online tools like:
- ezgif.com/video-to-gif
- cloudconvert.com/mp4-to-gif

## Questions?

Refer to `press-kit/faq.md` for common questions and answers.
