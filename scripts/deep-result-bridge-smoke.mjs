import assert from 'node:assert/strict';

const copyModule = await import('../src/lib/deep-result/copy.ts');
const copyExports = copyModule['module.exports'] ?? copyModule.default ?? copyModule;
const { buildDeepResultReasonBridge, buildFirstSessionBridge } = copyExports;

const cautionPriority = {
  lower_stability: 1,
  asymmetry: 0.7,
  trunk_control: 0.4,
};

const reasonBridge = buildDeepResultReasonBridge(
  cautionPriority,
  'caution',
  ['glute_medius']
);

assert(reasonBridge, 'reason bridge should be created for v3 priority vector');
assert(reasonBridge.bullets.length >= 2, 'reason bridge should include at least two bullets');
assert(
  reasonBridge.bullets.some((text) => text.includes('보수적으로')),
  'caution pain mode should add conservative intensity guidance'
);

const protectedBridge = buildFirstSessionBridge(
  { deconditioned: 1, trunk_control: 0.6 },
  'protected',
  ['breathing_reset']
);

assert(protectedBridge, 'first session bridge should be created for v3 priority vector');
assert(
  protectedBridge.principles.some((text) => text.includes('보수적으로 시작')),
  'protected pain mode should keep conservative first session principle'
);
assert(
  protectedBridge.note?.includes('안정적인 연결'),
  'protected bridge note should explain stable low-intensity start'
);

const fallbackBridge = buildFirstSessionBridge(null, null, []);
assert.equal(fallbackBridge, null, 'bridge should stay null when no v3 priority vector exists');

console.log('deep-result-bridge smoke passed');
