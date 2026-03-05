# QA Checklist Template

Use this checklist to systematically verify game quality before release. Complete all applicable items for each game implementation.

---

## Game Information

| Field | Value |
|-------|-------|
| **Game Name** | |
| **Slug** | `game-name/` |
| **Tester** | |
| **Date** | |
| **Build Version** | |
| **Browser(s) Tested** | |
| **Device(s) Tested** | |

---

## Section 1: Core Gameplay (10 items)

### 1.1 Game Mechanics

- [ ] **Objective Clear**: Player understands the goal within 5 seconds of starting
- [ ] **Rules Consistent**: Game rules apply uniformly throughout gameplay
- [ ] **Win Condition Works**: Game correctly detects and celebrates victory
- [ ] **Lose Condition Works**: Game correctly detects and handles failure states
- [ ] **Scoring Accurate**: Points/score updates correctly for all actions

### 1.2 Game Flow

- [ ] **Start/Restart Works**: Game can be started and restarted without errors
- [ ] **Pause/Resume Works**: Pause freezes game state, resume continues correctly
- [ ] **Level Progression**: Advancing to next level works as expected
- [ ] **Game Over Flow**: Proper game over screen with replay option
- [ ] **No Soft Locks**: Player cannot get stuck in unrecoverable states

**Section Score:** ___ / 10

| Status | Criteria |
|--------|----------|
| PASS | 10/10 items checked |
| PASS WITH ISSUES | 8-9/10 items checked (document issues) |
| FAIL | < 8/10 items checked |

---

## Section 2: Controls (8 items)

### 2.1 Input Handling

- [ ] **Touch Responsive**: All touch inputs register within 100ms
- [ ] **Mouse Fallback**: Mouse input works on desktop browsers
- [ ] **Multi-touch Support**: Simultaneous touches handled correctly (if applicable)
- [ ] **Gesture Recognition**: Swipe/pinch/drag gestures detected accurately

### 2.2 Control Feedback

- [ ] **Visual Feedback**: UI responds visually to input (hover, press states)
- [ ] **Audio Feedback**: Sound plays on input when appropriate
- [ ] **Haptic Ready**: Vibration API calls in place (even if not triggered)
- [ ] **No Ghost Inputs**: No unintended input registration after lift

**Section Score:** ___ / 8

| Status | Criteria |
|--------|----------|
| PASS | 8/8 items checked |
| PASS WITH ISSUES | 6-7/8 items checked (document issues) |
| FAIL | < 6/8 items checked |

---

## Section 3: History System (6 items)

### 3.1 Undo Functionality

- [ ] **Undo Works**: Single undo correctly reverts last action
- [ ] **Multiple Undo**: Can undo multiple actions in sequence
- [ ] **Undo Limit**: Respects maximum undo count (if applicable)
- [ ] **State Integrity**: Game state remains valid after undo operations

### 3.2 State Management

- [ ] **History Accuracy**: Undo returns to exact previous state
- [ ] **Memory Efficient**: History doesn't cause memory issues on long sessions

**Section Score:** ___ / 6

| Status | Criteria |
|--------|----------|
| PASS | 6/6 items checked |
| PASS WITH ISSUES | 5/6 items checked (document issues) |
| FAIL | < 5/6 items checked |

---

## Section 4: Progression (6 items)

### 4.1 Level System

- [ ] **Level Data Loads**: All level data loads without errors
- [ ] **Difficulty Curve**: Levels progress in appropriate difficulty
- [ ] **Level Unlocks**: New levels unlock correctly upon completion

### 4.2 Persistence

- [ ] **Progress Saved**: Completed levels persist after browser refresh
- [ ] **Settings Saved**: User preferences persist across sessions
- [ ] **No Progress Loss**: No unexpected progress resets

**Section Score:** ___ / 6

| Status | Criteria |
|--------|----------|
| PASS | 6/6 items checked |
| PASS WITH ISSUES | 5/6 items checked (document issues) |
| FAIL | < 5/6 items checked |

---

## Section 5: Visual Polish (8 items)

### 5.1 Graphics Quality

- [ ] **No Visual Glitches**: No rendering artifacts or tearing
- [ ] **Smooth Animations**: Animations run at consistent 60fps
- [ ] **Asset Quality**: Images/sprites are crisp and appropriately sized
- [ ] **Color Contrast**: UI elements have sufficient contrast for visibility

### 5.2 UI/UX

- [ ] **Consistent Styling**: UI elements follow design system
- [ ] **Readable Text**: All text is legible at intended sizes
- [ ] **Button Sizes**: Touch targets are minimum 44x44 pixels
- [ ] **Loading States**: Loading indicators shown during async operations

**Section Score:** ___ / 8

| Status | Criteria |
|--------|----------|
| PASS | 8/8 items checked |
| PASS WITH ISSUES | 6-7/8 items checked (document issues) |
| FAIL | < 6/8 items checked |

---

## Section 6: Audio (4 items)

### 6.1 Sound Effects

- [ ] **SFX Play Correctly**: Sound effects trigger at appropriate times
- [ ] **No Audio Glitches**: No popping, clicking, or distortion
- [ ] **Volume Consistent**: Audio levels are balanced across all sounds
- [ ] **Mute Works**: Mute toggle correctly silences all game audio

**Section Score:** ___ / 4

| Status | Criteria |
|--------|----------|
| PASS | 4/4 items checked |
| PASS WITH ISSUES | 3/4 items checked (document issues) |
| FAIL | < 3/4 items checked |

---

## Section 7: Responsive Design (6 items)

### 7.1 Layout

- [ ] **Portrait Works**: Game playable in portrait orientation
- [ ] **Landscape Works**: Game playable in landscape (if supported)
- [ ] **Orientation Switch**: Layout adjusts properly on rotation

### 7.2 Screen Sizes

- [ ] **Small Screens**: Works on screens 320px wide and above
- [ ] **Large Screens**: Scales appropriately on tablets/desktop
- [ ] **Safe Areas**: UI avoids notches and system UI

**Section Score:** ___ / 6

| Status | Criteria |
|--------|----------|
| PASS | 6/6 items checked |
| PASS WITH ISSUES | 5/6 items checked (document issues) |
| FAIL | < 5/6 items checked |

---

## Section 8: Performance (4 items)

### 8.1 Metrics

- [ ] **Frame Rate**: Maintains 60fps during gameplay (no drops below 30fps)
- [ ] **Load Time**: Initial load completes in under 3 seconds on 3G
- [ ] **Memory Usage**: Memory footprint stays under 100MB
- [ ] **No Memory Leaks**: Memory doesn't grow unbounded during play

**Section Score:** ___ / 4

| Status | Criteria |
|--------|----------|
| PASS | 4/4 items checked |
| PASS WITH ISSUES | 3/4 items checked (document issues) |
| FAIL | < 3/4 items checked |

---

## Section 9: Edge Cases (6 items)

### 9.1 Boundary Conditions

- [ ] **Empty State**: Handles empty game board/hand appropriately
- [ ] **Full State**: Handles maximum capacity states without errors
- [ ] **Rapid Input**: Handles fast/repeated inputs gracefully

### 9.2 Error Recovery

- [ ] **Network Loss**: Graceful degradation if network required
- [ ] **Storage Full**: Handles localStorage quota exceeded
- [ ] **Corrupt Data**: Recovers from corrupted saved state

**Section Score:** ___ / 6

| Status | Criteria |
|--------|----------|
| PASS | 6/6 items checked |
| PASS WITH ISSUES | 5/6 items checked (document issues) |
| FAIL | < 5/6 items checked |

---

## Summary

### Overall Scores

| Section | Score | Status |
|---------|-------|--------|
| Core Gameplay | ___ / 10 | [ ] PASS [ ] PASS WITH ISSUES [ ] FAIL |
| Controls | ___ / 8 | [ ] PASS [ ] PASS WITH ISSUES [ ] FAIL |
| History System | ___ / 6 | [ ] PASS [ ] PASS WITH ISSUES [ ] FAIL |
| Progression | ___ / 6 | [ ] PASS [ ] PASS WITH ISSUES [ ] FAIL |
| Visual Polish | ___ / 8 | [ ] PASS [ ] PASS WITH ISSUES [ ] FAIL |
| Audio | ___ / 4 | [ ] PASS [ ] PASS WITH ISSUES [ ] FAIL |
| Responsive Design | ___ / 6 | [ ] PASS [ ] PASS WITH ISSUES [ ] FAIL |
| Performance | ___ / 4 | [ ] PASS [ ] PASS WITH ISSUES [ ] FAIL |
| Edge Cases | ___ / 6 | [ ] PASS [ ] PASS WITH ISSUES [ ] FAIL |
| **TOTAL** | ___ / 58 | |

### Pass/Fail Criteria

| Status | Criteria |
|--------|----------|
| **READY FOR RELEASE** | All sections PASS |
| **NEEDS MINOR FIXES** | 1-2 sections PASS WITH ISSUES, rest PASS |
| **NEEDS WORK** | Any section FAIL or 3+ sections PASS WITH ISSUES |
| **BLOCKED** | 2+ sections FAIL |

### Final Decision

**Overall Status:** [ ] READY FOR RELEASE [ ] NEEDS MINOR FIXES [ ] NEEDS WORK [ ] BLOCKED

**Blocker Issues:**
> [List any issues that must be resolved before release]

**Minor Issues:**
> [List issues that should be fixed but don't block release]

**Recommendations:**
> [Any suggestions for improvement]

---

## Issues Log

Use this section to document specific issues found during testing.

| # | Section | Description | Severity | Status |
|---|---------|-------------|----------|--------|
| 1 | | | Critical/Major/Minor | Open/Fixed/Won't Fix |
| 2 | | | Critical/Major/Minor | Open/Fixed/Won't Fix |
| 3 | | | Critical/Major/Minor | Open/Fixed/Won't Fix |
| 4 | | | Critical/Major/Minor | Open/Fixed/Won't Fix |
| 5 | | | Critical/Major/Minor | Open/Fixed/Won't Fix |

### Severity Definitions

| Level | Definition |
|-------|------------|
| **Critical** | Blocks release, game unplayable or broken |
| **Major** | Significant issue affecting gameplay, should fix before release |
| **Minor** | Cosmetic or edge case, can fix post-release |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Tester | | | |
| Reviewer | | | |

---

*Template Version: 1.0 | Last Updated: 2025-03-05*
