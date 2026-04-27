# Pilot camera — real-device checklist (2026-05-01)

**Automated smoke (`npm run test:pilot-camera`) does not satisfy this document.** Complete this checklist on physical devices before treating camera as pilot-ready.

## Required devices

- iPhone — Safari
- iPhone — PWA (if installed)
- Android — Chrome
- Android — PWA (if installed)
- Optional: Instagram in-app browser (iOS/Android)
- Optional: KakaoTalk in-app browser

## Required flow

1. Open public entry (canonical pilot path).
2. Start camera test.
3. Setup screen appears.
4. Squat phase starts.
5. Overhead reach phase starts.
6. Result appears or camera refine completes as designed.

## Squat — required checks

- Shallow squat: **3 attempts**, at least **2** natural passes.
- Deep squat: **1** natural pass.
- Standing small movement: **must fail** (no false pass).
- Descent-start-only: **must fail**.
- Seated / bottom hold: **must fail**.
- Arm-only: **must fail**.

## Overhead reach — required checks

- Not an instant pass (no trivial latch without meaningful hold).
- Not impossible to pass with reasonable form.
- Meaningful top-hold behavior exists.
- Voice/cue does not overlap excessively.

## Performance

- No severe frame lag during capture.
- Camera preview remains responsive across attempts.
- Pose overlay appears **only** with explicit diagnostic query flag (if applicable).
- No obvious memory/performance freeze across retries.

## Manual hard fails

Treat as **FAIL** and block pilot for camera until addressed:

- Shallow squat cannot pass naturally (within reasonable attempts).
- Standing movement passes as squat.
- Seated/bottom hold passes as squat.
- Arm-only passes as squat.
- Overhead reach passes instantly without meaningful hold.
- Overhead reach impossible to pass with reasonable effort.
- Severe frame lag blocks self-serve capture.
- Voice guide spam or overlap makes the test unusable.

## Manual result table

| Device | Browser | Squat | False-pass cases | Overhead reach | Voice | Performance | Result | Notes |
|--------|---------|-------|------------------|----------------|-------|-------------|--------|-------|
| | | PASS / FAIL / NOT_TESTED | PASS / FAIL / NOT_TESTED | PASS / FAIL / NOT_TESTED | PASS / FAIL / NOT_TESTED | PASS / FAIL / NOT_TESTED | PASS / FAIL / NOT_TESTED | |

Repeat rows per device/browser combination tested.

**Result column:** `PASS` only if all relevant rows for that run are acceptable; otherwise `FAIL` or `NOT_TESTED` as appropriate.
