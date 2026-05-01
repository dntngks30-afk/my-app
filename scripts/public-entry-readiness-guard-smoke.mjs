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
mustNotInclude(ctaFile, 'fetchReadinessClient', 'LandingReturnHomeCta must not fetch readiness (page owner)');
mustInclude(ctaFile, 'canReturnHome', 'LandingReturnHomeCta prop-driven return-home gate');
mustNotInclude(ctaFile, 'supabaseBrowser.auth.getSession()', 'LandingReturnHomeCta session-only gate removed');

const landingPage = fs.readFileSync('src/app/(main)/page.tsx', 'utf8');
mustInclude(landingPage, "readiness?.next_action.code === 'GO_APP_HOME'", 'Landing page GO_APP_HOME return-home gate');
mustInclude(landingPage, "readiness?.onboarding?.is_complete === true", 'Landing page onboarding complete gate');
mustInclude(landingPage, 'LandingReturnHomeCta', 'Landing page return-home CTA wiring');
mustInclude(landingPage, 'LandingExistingAccountModal', 'Landing page existing account modal wiring');
mustInclude(landingPage, 'supabaseBrowser.auth.signOut()', 'Landing page fresh-start signOut');
mustInclude(landingPage, 'clearPublicPreAuthTempStateForPilotStart()', 'Landing page fresh-start clear temp state');
mustInclude(landingPage, "router.push('/intro/welcome')", 'Landing page fresh-start intro redirect');

const readinessOwner = fs.readFileSync('src/lib/readiness/session-readiness-owner.internal.ts', 'utf8');
const idxOnboarding = readinessOwner.indexOf("} else if (!onboardingComplete)");
const idxActive = readinessOwner.indexOf("} else if (ctx.hasActiveSession)");
if (idxOnboarding === -1 || idxActive === -1 || idxOnboarding > idxActive) {
  throw new Error('[FAIL] readiness priority: onboarding check must come before hasActiveSession check');
}

console.log('PASS: public-entry-readiness-guard smoke checks');
