# THIN-EVIDENCE-PASS-RESET-01 SSOT
Date: 2026-04-04
Repo: dntngks30-afk/my-app

## 0. Why this reset exists
Current real-device truth shows the system is very close:
- multiple shallow attempts now pass after a meaningful descent -> reversal/ascent -> standing recovery
- but one remaining class of false pass still exists: a shallow pass can open from **thin evidence** before the movement feels sufficiently established

This reset exists only to remove that last thin-evidence pass class.
It must **not** re-break the newly recovered good shallow pass experience.

---

## 1. Hard product law
A squat passes if and only if one same rep contains:
1. meaningful descent
2. meaningful reversal / ascent
3. standing recovery

This reset is narrow:
- keep all currently good shallow success cases working
- block only thin-evidence early shallow passes

---

## 2. Locked truths from recent validation
### 2.1 Preserved success class
There are now good shallow passes whose pass-core traces show clearly structured post-peak evidence and materially longer motion windows, for example:
- dspan_ms around 206.9ms with rev_span around 1100.6ms
- dspan_ms around 300.2ms with rev_span around 884.4ms
These are the good experiences that must remain possible.

### 2.2 Remaining bad class
The remaining false-pass class is a thin-evidence pass where user-visible pass still opens even though the evidence window is materially thinner, for example:
- completion still says `descent_span_too_short`
- baseline / peak legacy surfaces may still look weak
- pass-core trace can still show a short total cycle and especially a short post-peak reversal span
- example thin-evidence signature includes cycle around 684ms, dspan_ms around 200.7ms, rev_span around 196.3ms, std_fr=2

This is the class to remove.

---

## 3. Root cause lock
The remaining issue is not guardrail, not same-frame reversal+standing, and not broad descent ownership anymore.

The remaining issue is:
**pass-core still allows pass from too-little total motion evidence, especially too-thin post-peak evidence and too-thin overall cycle evidence.**

In other words, the pass floor is still too low for one remaining shallow pattern.

---

## 4. Scope boundary (hard lock)
This PR must be extremely narrow.

### Allowed scope
- `src/lib/camera/squat/pass-core.ts`
- minimal directly-related structural test file(s)
- docs for this SSOT

### Forbidden scope
- do not touch guardrail ownership
- do not touch auto-progression final ownership rules
- do not re-couple pass-core to completionBlockedReason
- do not reopen same-frame reversal/standing logic
- do not broaden scope into UI/camera pipeline/refactor work
- do not modify completion-state as motion owner
- do not add downstream revokers

---

## 5. Reset intent
This reset is:
- **THIN-EVIDENCE-PASS-RESET-01**

It is not:
- a broad threshold retune PR
- a descent ownership rewrite
- a reversal ownership rewrite
- a guardrail PR

It is only:
**raise the minimum evidence floor for pass-core just enough to kill the remaining thin-evidence shallow false pass.**

---

## 6. Required design rule
Pass-core may open pass only if the movement clears all existing structural gates **and** the total evidence is not thin.

This thin-evidence floor may be expressed only through pass-core-owned evidence such as:
- minimum total cycle duration
- minimum post-peak reversal span
- minimum post-peak recovery/standing stabilization span
- equivalent pass-core-owned composite evidence floor

But it must NOT rely on:
- completionBlockedReason as authority
- guardrail veto
- downstream revocation

---

## 7. Preserve-good-pass law (hard lock)
The new successful shallow experiences must remain passable.

This means:
- do not over-raise thresholds
- do not require deep squat behavior
- do not require a new class of evidence that the currently-good shallow passes do not have

The implementation must preserve the successful class that already shows:
- meaningful descent
- structured reversal (e.g. rev_fr=3)
- structured standing recovery (e.g. std_fr=2)
- materially longer motion window than the thin false-pass case

---

## 8. Blocked class (hard lock)
The PR must now block the remaining false-pass class where:
- pass opens too early from shallow motion
- completion still says `descent_span_too_short`
- total cycle evidence is too short / thin
- post-peak reversal span is too short / thin
- the overall movement does not feel like a full descent -> ascent -> recovery experience yet

---

## 9. Implementation principle
Do not guess broadly.
Do not sweep thresholds everywhere.

Only introduce the smallest additional pass-core evidence requirement needed to separate:
- good shallow passes (preserve)
from
- thin-evidence early shallow pass (block)

This is a boundary-tightening PR, not a behavior rewrite PR.

---

## 10. Acceptance definition
This PR is accepted only if all are true:
- the currently-good shallow passes still pass
- the remaining thin-evidence early shallow pass no longer passes
- pass-core remains the only motion pass writer
- no downstream revoker is introduced
- no guardrail/ownership regression is introduced
- same-frame reversal/standing protection remains intact

---

## 11. Real-device truth priority
Automated checks are structural guards only.
Real-device JSON remains the final truth.

Required real-device acceptance:
- good successful class still passes
- thin false-pass class no longer opens pass

---

## 12. Immediate stop conditions
Stop and report before continuing if any are true:
- the only apparent fix is to re-couple pass-core to completionBlockedReason
- the narrow fix would also block the currently-good shallow pass class
- the fix requires reopening guardrail or completion ownership
- the fix requires weakening the structured reversal/standing protections