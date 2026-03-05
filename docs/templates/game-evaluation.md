# Game Evaluation Template

Use this template to systematically evaluate potential new games before committing to implementation.

---

## Game Information

| Field | Value |
|-------|-------|
| **Game Name** | |
| **Proposed Slug** | `game-name/` |
| **Source** | [ ] App Store ad [ ] TikTok/Reels [ ] Reddit [ ] Itch.io [ ] Player request [ ] Other: ___ |
| **Reference URL** | |
| **Evaluator** | |
| **Date** | |
| **Prototype Required** | [ ] Yes [ ] No (obviously good fit) |

---

## Section 1: Feasibility Score

### 1.1 Technical Constraints

| Criterion | Score | Notes |
|-----------|-------|-------|
| **Client-side only?** | /5 | Must work without backend |
| **Deterministic?** | /5 | Same seed = same result |
| **Mobile touch friendly?** | /5 | Works with finger, not just mouse |
| **Portrait orientation?** | /5 | Optimal for mobile |
| **Performance viable?** | /5 | Runs smoothly on mid-range phones |
| **Offline capable?** | /5 | No network required after load |

**Feasibility Subtotal:** ___ / 30

### 1.2 Implementation Complexity

| Criterion | Score | Notes |
|-----------|-------|-------|
| **Core mechanic simplicity** | /5 | How complex is the main game loop? |
| **State management** | /5 | Easy to track and undo? |
| **Rendering requirements** | /5 | Canvas? WebGL? Simple DOM? |
| **Level generation** | /5 | Handcrafted, procedural, or hybrid? |
| **Asset requirements** | /5 | Sprites, audio, animations needed? |

**Complexity Subtotal:** ___ / 25

### 1.3 Feasibility Assessment

**Total Feasibility Score:** ___ / 55

| Score Range | Verdict |
|-------------|---------|
| 45-55 | **Excellent** - Straightforward implementation |
| 35-44 | **Good** - Some challenges but manageable |
| 25-34 | **Moderate** - Requires careful planning |
| < 25 | **Low** - May not be worth the effort |

**Feasibility Verdict:** [ ] Excellent [ ] Good [ ] Moderate [ ] Low

---

## Section 2: Appeal Score

### 2.1 Gameplay Appeal

| Criterion | Score | Notes |
|-----------|-------|-------|
| **Satisfying feedback** | /5 | Feels good to interact with |
| **Clear objective** | /5 | Player knows what to do immediately |
| **Depth potential** | /5 | Can introduce complexity over time |
| **Progression feel** | /5 | Sense of advancement and mastery |
| **Replayability** | /5 | Worth playing multiple times |

**Gameplay Subtotal:** ___ / 25

### 2.2 Market Appeal

| Criterion | Score | Notes |
|-----------|-------|-------|
| **Proven concept** | /5 | Similar games successful? |
| **Target audience size** | /5 | Broad or niche appeal? |
| **Viral potential** | /5 | Share-worthy moments? |
| **Monetization fit** | /5 | Ads, IAP friendly (if applicable) |

**Market Subtotal:** ___ / 20

### 2.3 Appeal Assessment

**Total Appeal Score:** ___ / 45

| Score Range | Verdict |
|-------------|---------|
| 38-45 | **Excellent** - High engagement potential |
| 28-37 | **Good** - Solid appeal, worth pursuing |
| 18-27 | **Moderate** - May need refinement |
| < 18 | **Low** - Limited player interest likely |

**Appeal Verdict:** [ ] Excellent [ ] Good [ ] Moderate [ ] Low

---

## Section 3: Differentiation Score

### 3.1 Competitive Analysis

| Existing Game | Platform | What They Do Well | What We Can Improve |
|---------------|----------|-------------------|---------------------|
| | | | |
| | | | |
| | | | |

### 3.2 Differentiation Factors

| Criterion | Score | Notes |
|-----------|-------|-------|
| **Unique twist** | /5 | What makes ours different? |
| **Quality gap** | /5 | Can we do it better? |
| **Feature gap** | /5 | Missing features in competitors? |
| **Platform fit** | /5 | Better suited for web/PWA? |
| **Audience underserved** | /5 | Unmet player needs? |

**Differentiation Subtotal:** ___ / 25

### 3.3 Differentiation Assessment

**Total Differentiation Score:** ___ / 25

| Score Range | Verdict |
|-------------|---------|
| 20-25 | **Excellent** - Clear competitive advantage |
| 15-19 | **Good** - Meaningful improvements |
| 10-14 | **Moderate** - Incremental better |
| < 10 | **Low** - Hard to stand out |

**Differentiation Verdict:** [ ] Excellent [ ] Good [ ] Moderate [ ] Low

---

## Section 4: Risk Assessment

### 4.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance on low-end devices | L/M/H | L/M/H | |
| Touch control accuracy | L/M/H | L/M/H | |
| Level generation quality | L/M/H | L/M/H | |
| State complexity | L/M/H | L/M/H | |
| Other: ___ | L/M/H | L/M/H | |

### 4.2 Design Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Fun factor uncertain | L/M/H | L/M/H | |
| Difficulty balance | L/M/H | L/M/H | |
| Visual clarity | L/M/H | L/M/H | |
| Accessibility | L/M/H | L/M/H | |
| Other: ___ | L/M/H | L/M/H | |

### 4.3 Market Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Saturated category | L/M/H | L/M/H | |
| Trend fading | L/M/H | L/M/H | |
| Player expectations | L/M/H | L/M/H | |
| Other: ___ | L/M/H | L/M/H | |

### 4.4 Risk Summary

**High-Impact Risks:**
- [List any H/H or M/H combinations]

**Acceptable Risks:**
- [List risks with acceptable likelihood/impact]

**Go/No-Go Blockers:**
- [Any risk that would stop the project]

---

## Section 5: Final Evaluation

### Summary Scores

| Category | Score | Max | Verdict |
|----------|-------|-----|---------|
| Feasibility | ___ | 55 | |
| Appeal | ___ | 45 | |
| Differentiation | ___ | 25 | |
| **TOTAL** | ___ | 125 | |

### Decision Matrix

| Total Score | Recommendation |
|-------------|----------------|
| 100-125 | **BUILD** - High priority, start immediately |
| 80-99 | **BUILD** - Normal priority, good fit |
| 60-79 | **PROTOTYPE** - Validate fun factor first |
| 40-59 | **DEFER** - Needs refinement or lower priority |
| < 40 | **PASS** - Not a good fit |

### Final Decision

**Decision:** [ ] BUILD [ ] PROTOTYPE [ ] DEFER [ ] PASS

**Priority:** [ ] P0 (Critical) [ ] P1 (High) [ ] P2 (Normal) [ ] P3 (Low)

**Rationale:**
> [Brief explanation of decision and any conditions]

### Next Steps

- [ ] Create feature branch `feat/<game-slug>`
- [ ] Run scaffold generator: `scripts/new-game.sh <game-slug>`
- [ ] Implement core mechanic prototype
- [ ] Conduct 1-2 day fun validation
- [ ] Re-evaluate if uncertain

---

## Appendix: Scoring Guide

### Score Definitions

| Score | Meaning |
|-------|---------|
| 5 | Excellent - No concerns, optimal fit |
| 4 | Good - Minor concerns, easily addressed |
| 3 | Average - Some concerns, manageable |
| 2 | Below Average - Significant concerns |
| 1 | Poor - Major issues, likely blocker |

### Likelihood/Impact Definitions

| Level | Likelihood | Impact |
|-------|------------|--------|
| **H** | > 50% chance | Project-blocking if occurs |
| **M** | 20-50% chance | Significant delay/compromise |
| **L** | < 20% chance | Minor inconvenience |

---

*Template Version: 1.0 | Last Updated: 2025-03-05*
