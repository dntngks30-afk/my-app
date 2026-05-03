/**
 * PR-KPI-LINT-SCRIPT-FIX: verify lint uses ESLint CLI (not next lint) and deps/config exist.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgPath = join(root, "package.json");
const eslintConfigPath = join(root, "eslint.config.mjs");

function fail(msg) {
  console.error(`[lint-command-smoke] FAILED: ${msg}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const lint = pkg.scripts?.lint;
if (typeof lint !== "string" || !lint.trim()) fail("scripts.lint missing");

const lintLc = lint.toLowerCase();
if (!lintLc.includes("eslint")) fail(`scripts.lint must invoke eslint; got: ${lint}`);
if (/\bnext\s+lint\b/i.test(lint)) fail(`scripts.lint must not use "next lint"; got: ${lint}`);

const devDeps = pkg.devDependencies ?? {};
if (!devDeps.eslint) fail("devDependencies.eslint missing");
if (!devDeps["eslint-config-next"]) fail("devDependencies[\"eslint-config-next\"] missing");

if (!existsSync(eslintConfigPath)) fail("eslint.config.mjs missing");

const eslintConfigSrc = readFileSync(eslintConfigPath, "utf8");
if (!eslintConfigSrc.includes("globalIgnores")) fail("eslint.config.mjs must contain globalIgnores");

for (const needle of [".next/**", "node_modules/**", "supabase/migrations/**"]) {
  if (!eslintConfigSrc.includes(needle)) {
    fail(`eslint.config.mjs globalIgnores must include "${needle}"`);
  }
}

console.log("[lint-command-smoke] passed");
