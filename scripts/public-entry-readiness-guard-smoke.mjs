import fs from 'node:fs';

function mustInclude(content, snippet, label) {
  if (!content.includes(snippet)) {
    throw new Error(`[FAIL] ${label}: missing snippet -> ${snippet}`);
  }
}

function mustNotInclude(content, snippet, label) {
  if (content.includes(snippet)) {
    throw new Error(`[FAIL] ${label}: forbidden snippet found -> ${snippet}`);
  }
}

const ctaFile = fs.readFileSync('src/components/landing/LandingReturnHomeCta.tsx', 'utf8');
mustInclude(ctaFile, "fetchReadinessClient", 'LandingReturnHomeCta readiness fetch');
mustInclude(ctaFile, "readiness?.next_action.code === 'GO_APP_HOME'", 'LandingReturnHomeCta GO_APP_HOME gate');
mustInclude(ctaFile, "readiness?.onboarding.is_complete === true", 'LandingReturnHomeCta onboarding complete gate');
mustNotInclude(ctaFile, 'supabaseBrowser.auth.getSession()', 'LandingReturnHomeCta session-only gate removed');

const readinessOwner = fs.readFileSync('src/lib/readiness/session-readiness-owner.internal.ts', 'utf8');
const idxOnboarding = readinessOwner.indexOf("} else if (!onboardingComplete)");
const idxActive = readinessOwner.indexOf("} else if (ctx.hasActiveSession)");
if (idxOnboarding === -1 || idxActive === -1 || idxOnboarding > idxActive) {
  throw new Error('[FAIL] readiness priority: onboarding check must come before hasActiveSession check');
}

const landingPage = fs.readFileSync('src/app/(main)/page.tsx', 'utf8');
mustInclude(landingPage, 'LandingExistingAccountModal', 'Landing page existing account modal wiring');
mustInclude(landingPage, 'supabaseBrowser.auth.signOut()', 'Landing page fresh-start signOut');
mustInclude(landingPage, 'clearPublicPreAuthTempStateForPilotStart()', 'Landing page fresh-start clear temp state');
mustInclude(landingPage, "router.push('/intro/welcome')", 'Landing page fresh-start intro redirect');

console.log('PASS: public-entry-readiness-guard smoke checks');
