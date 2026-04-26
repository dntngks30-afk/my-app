/**
 * PR-V2-INPUT-06 — Deep input audit smoke (observability only).
 * Run: npx tsx scripts/camera-squat-v2-06-deep-input-audit-smoke.mjs
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(join(__dirname, ".."));

const { buildV2DeepInputAudit } = await import("../src/lib/camera/evaluators/squat.ts");

let passed = 0;
let failed = 0;

function ok(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}${detail ? `: ${detail}` : ""}`);
  }
}

function mkLm(y, vis = 0.95) {
  return { x: 0.5, y, visibility: vis };
}

function makeFrame(ts, o = {}) {
  const vis = o.vis ?? 0.95;
  const hipY = o.hipY ?? 0.5;
  return {
    timestampMs: ts,
    joints: {
      leftHip: mkLm(hipY, vis),
      rightHip: mkLm(hipY, vis),
      hipCenter: mkLm(hipY, vis),
      leftKnee: mkLm(hipY + 0.06, vis),
      rightKnee: mkLm(hipY + 0.06, vis),
      leftAnkle: mkLm(hipY + 0.12, vis),
      rightAnkle: mkLm(hipY + 0.12, vis),
    },
    derived: {
      kneeAngleAvg: o.knee ?? 95,
      pelvicDrop: o.pelvis ?? 0.04,
      squatDepthProxyBlended: o.b ?? 0.1,
      squatDepthProxy: o.p ?? 0.1,
      squatDepthProxyRaw: o.r ?? 0.1,
    },
  };
}

function assertCompactAudit(a) {
  const bad = [];
  const walk = (v, path) => {
    if (v == null) return;
    if (Array.isArray(v)) {
      if (v.length > 8 && typeof v[0] === "number") bad.push(path);
      v.forEach((x, i) => walk(x, `${path}[${i}]`));
      return;
    }
    if (typeof v === "object") {
      for (const k of Object.keys(v)) walk(v[k], `${path}.${k}`);
    }
  };
  walk(a, "audit");
  return bad;
}

// A: long raw + short v2 tail, strong raw vs weak v2
{
  const fps = 10;
  const raw = [];
  for (let i = 0; i < 60; i++) {
    const t = i * (1000 / fps);
    const deep = i < 40 ? 0.15 + i * 0.004 : 0.12;
    raw.push(
      makeFrame(t, {
        hipY: 0.5 - (i < 40 ? i * 0.003 : 0.35),
        knee: 90 + (i < 40 ? i * 0.8 : 5),
        pelvis: 0.02 + (i < 40 ? i * 0.002 : 0.001),
        b: deep,
        p: deep,
        r: deep,
      })
    );
  }
  const v2 = raw.slice(-15);
  const a = buildV2DeepInputAudit({ validRaw: raw, chosenV2EvalFrames: v2, shallowRecoveryDiag: null });
  ok("A audit.version", a.version === "v2-deep-input-audit-06");
  ok("A dropped prefix frames > 0", a.v2InputDroppedPrefixFrameCount > 0);
  ok("A has likelyRootCause", typeof a.likelyRootCause === "string");
  const bad = assertCompactAudit(a);
  ok("A compact (no large number arrays)", bad.length === 0, bad.join(","));
}

// B: uniformly micro raw
{
  const raw = [];
  for (let i = 0; i < 20; i++) {
    raw.push(makeFrame(i * 100, { hipY: 0.5, knee: 90.1, pelvis: 0.001, b: 0.01, p: 0.01, r: 0.01 }));
  }
  const a = buildV2DeepInputAudit({ validRaw: raw, chosenV2EvalFrames: raw.slice(-8), shallowRecoveryDiag: null });
  ok(
    "B insufficient or unknown",
    a.likelyRootCause === "insufficient_raw_evidence" || a.likelyRootCause === "unknown"
  );
}

// C: terrible visibility
{
  const raw = [];
  for (let i = 0; i < 25; i++) {
    raw.push(makeFrame(i * 100, { vis: 0.05, hipY: 0.5 - i * 0.001, knee: 100, pelvis: 0.05, b: 0.2, p: 0.2, r: 0.2 }));
  }
  const a = buildV2DeepInputAudit({ validRaw: raw, chosenV2EvalFrames: raw.slice(-10), shallowRecoveryDiag: null });
  ok(
    "C visibility classification or unknown",
    a.likelyRootCause === "lower_body_landmarks_not_visible" || a.likelyRootCause === "unknown"
  );
}

console.log(`\nPR06 deep input audit smoke: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
