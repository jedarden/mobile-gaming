# App Store Screenshots

This directory contains screenshot templates for PWA directories and app stores.

## Files

- `iphone-screenshot-home.svg` - Home screen showing all 4 games (iPhone 14 Pro Max size: 1290x2796)
- `iphone-screenshot-gameplay.svg` - Water Sort gameplay example

## Screenshot Sizes

### iOS App Store
- **iPhone 14 Pro Max**: 1290 x 2796 pixels
- **iPhone 14 Plus**: 1284 x 2778 pixels
- **iPhone 14 Pro**: 1179 x 2556 pixels
- **iPhone 14**: 1170 x 2532 pixels

### Google Play Store
- **Phone**: 1080 x 1920 pixels (16:9)
- **Tablet**: 1536 x 2048 pixels

### PWA Directories
- **Microsoft Store**: 1366 x 768 or 1920 x 1080
- **Samsung Galaxy Store**: 1080 x 1920

## Usage

### Convert SVG to PNG

```bash
# Using ImageMagick
convert iphone-screenshot-home.svg iphone-screenshot-home.png

# Using rsvg-convert (better quality)
rsvg-convert -w 1290 -h 2796 iphone-screenshot-home.svg -o iphone-screenshot-home.png

# Using Inkscape
inkscape iphone-screenshot-home.svg --export-type=png --export-filename=iphone-screenshot-home.png
```

### Generate All Sizes

```bash
# iPhone sizes
for size in "1290x2796" "1284x2778" "1179x2556" "1170x2532"; do
  w=${size%x*}
  h=${size#*x}
  rsvg-convert -w $w -h $h iphone-screenshot-home.svg -o iphone-home-${w}x${h}.png
done

# Android sizes
rsvg-convert -w 1080 -h 1920 iphone-screenshot-home.svg -o android-phone-home.png
rsvg-convert -w 1536 -h 2048 iphone-screenshot-home.svg -o android-tablet-home.png
```

## Screenshot Guidelines

### Apple App Store
- Maximum 10 screenshots per device type
- Must match device screen size exactly
- PNG or JPEG format
- Status bar optional but recommended
- No transparency

### Google Play Store
- Minimum 2 screenshots, maximum 8
- JPEG or 24-bit PNG (no alpha)
- Minimum 320px, maximum 3840px per dimension
- Aspect ratio between 2:1 and 1:2

### Content Guidelines
- Show actual gameplay
- Highlight key features
- Use clear, readable text
- Include game title/branding
- Avoid cluttered compositions

## Creating Additional Screenshots

### Per-Game Screenshots
Create separate screenshots for each game showing:
1. Level selection screen
2. Mid-gameplay with UI elements
3. Victory/completion state

### Feature Highlights
Create screenshots emphasizing:
- PWA offline capability
- No ads/interruptions
- Cross-device support
- Progress tracking
