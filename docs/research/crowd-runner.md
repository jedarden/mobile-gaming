# Crowd Runner / Count Masters

## Overview

A runner game where the player controls a crowd of stickmen sprinting down a corridor. Along the route, gates are labeled with arithmetic operations: `+10`, `×3`, `−5`, `÷2`. Players steer the crowd through gates to maximize army size. At the end of each level, the accumulated crowd smashes into an opposing crowd — the larger number wins.

## Game Mechanics

- **Setup:** 3D corridor with a crowd of stickmen, arithmetic gates placed in pairs across the path
- **Control:** Swipe left/right to steer the crowd through chosen gates
- **Gate logic:** Gates apply their operation to the current crowd count (e.g., 10 stickmen × 3 = 30)
- **Win condition:** Arrive at the final battle with more stickmen than the opposing crowd
- **Fail condition:** Crowd reduced to zero, or outnumbered at the final battle
- **Difficulty scaling:** More decision points, negative gates positioned temptingly, time pressure on gate choice

Some variants add obstacle-bashing sequences between gates, where the crowd physically smashes through barriers.

## What Makes It Appealing

### Sudden Abundance
The visual of a tiny crowd becoming a massive tidal wave after passing a `×3` gate is immediately gratifying. The math produces a visible, instant transformation — the screen fills with stickmen in one second. This sudden-abundance sensation is the game's core pleasure hit.

### Agency With Visible Consequence
The gate decision architecture teaches the game's mechanic in three seconds of ad viewing. Players feel the weight of choice: take the `+5` gate or risk the `×3` on the right? The decision outcome is immediate and unambiguous.

### Power Fantasy via Crowd Size
The crowd functions as an avatar of the player's strength. A large crowd is a proxy for social dominance and resource abundance. Watching it grow maps to deep-rooted instincts around group size and safety in numbers.

### Fail Ad Effectiveness
Ads showing the player accidentally choosing a `÷2` gate (crowd shrinks to a handful, then gets obliterated) are highly effective. Viewers feel the pain of the mistake and download to avoid it.

## Psychological Principles at Play

| Principle | Mechanism |
|---|---|
| **Numerical magnitude bias** | Humans have an intuitive positive response to large numbers; watching 3 become 300 triggers a windfall-like pleasure response |
| **Agency and control** | Steering through gates feels like skillful decision-making even when it reduces to timing |
| **Power fantasy / social dominance** | The crowd represents the player's strength; overwhelming opponents satisfies dominance drives |
| **FOMO / loss aversion** | The "wrong gate" fail ad makes viewers anxious about missing the multiplier; loss aversion is ~2× stronger than equivalent gain motivation |
| **Mathematical education fig leaf** | Parents allow children to play because the arithmetic gates appear educational |

## Notable Games

- **Count Masters: Crowd Runner 3D** (FreePlay) — the primary title in the format
- **Mob Control** (Voodoo) — pioneered the playable ad format for this genre
- **Crowd City** (Voodoo) — top-down crowd absorption variant; same core growth loop
- **Run Race 3D** — competitive gates variant with parkour obstacles

## Design Notes

The multiplication gate is far more satisfying than the addition gate — `×3` at crowd size 10 delivers a 20-stickman gain, while `+20` delivers only 20. Identical net gain, but the multiplication *feels* more powerful because it scales with what you already have. This is why ads always emphasize multiplication gates over addition gates. The mechanic exploits intuitive magnitude perception by making proportional rewards feel larger than absolute ones.

## Sources

- [Hyper-Casual Games: The Psychology of Why Simple Games Are So Addictive (Onia)](https://onia.fun/blog/hyper-casual-games-the-psychology-of-why-simple-games-are-so-addictive/)
- [Fake Mobile Game Ads (Udonis)](https://www.blog.udonis.co/mobile-marketing/mobile-games/fake-mobile-game-ads)
- [Fail Ads for Mobile Games (MAF)](https://maf.ad/en/blog/fail-ads-mobile-games/)
