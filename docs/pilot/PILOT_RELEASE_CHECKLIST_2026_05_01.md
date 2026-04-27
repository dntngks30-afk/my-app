# Pilot release checklist — 2026-05-01

## Automated gates

Run in CI or locally before calling the release **READY**:

```bash
npm run test:pilot-build
npm run test:pilot-session
npm run test:pilot-template-parity
npm run test:pilot-camera
npm run test:pilot-auth
npm run test:pilot-ready
```

Interpret **`npm run test:pilot-ready`** as the single summary:

- `FINAL STATUS: READY` — all hard gates pass and no tracked manual items remain per aggregator
- `FINAL STATUS: READY_WITH_MANUAL_CHECKS` — hard gates pass; explicit manual work still required
- `FINAL STATUS: BLOCKED` — at least one hard failure; do not ship pilot

## Required manual checks

Complete or explicitly waive with owner sign-off:

- Production Supabase template parity (if `test:pilot-template-parity` returned `MANUAL_REQUIRED`)
- Real-device camera checklist ([PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md](PILOT_CAMERA_REAL_DEVICE_CHECKLIST.md))
- Production Google login; production Kakao login
- In-app browser login (e.g. Instagram, KakaoTalk) where applicable
- Public homepage → test start
- Survey baseline result
- Optional camera refine path (bypass documented if intentional)
- Result → execution start
- Login/signup continuity
- Payment or pilot access path
- Onboarding minimal fields
- Session creation
- `/app/home` reset map
- Session panel
- Exercise player
- Session completion
- Next visit: stale legacy session not incorrectly reused
- PWA install prompt/path acceptable

## Final status decision

| Status | When |
|--------|------|
| **READY** | All automated gates pass; **no** remaining manual-required items per `test:pilot-ready` and sign-off |
| **READY_WITH_MANUAL_CHECKS** | All **hard** gates pass; manual items listed and accepted for controlled pilot |
| **BLOCKED** | Any automated hard fail, or manual **hard** fail (e.g. auth/camera/build) |

## Manual signoff table

| Item | Result | Owner | Notes |
|------|--------|-------|-------|
| Automated `test:pilot-ready` | PASS / FAIL / NOT_TESTED | | |
| Deploy / env ([PILOT_DEPLOY_ENV_CHECKLIST.md](PILOT_DEPLOY_ENV_CHECKLIST.md)) | PASS / FAIL / NOT_TESTED | | |
| Template parity (prod) | PASS / FAIL / NOT_TESTED | | |
| Real-device camera | PASS / FAIL / NOT_TESTED | | |
| OAuth production | PASS / FAIL / NOT_TESTED | | |
| End-to-end execution smoke | PASS / FAIL / NOT_TESTED | | |

## Non-goals

- This checklist does not replace incident response or security review.
- Do not store secrets in this file.
