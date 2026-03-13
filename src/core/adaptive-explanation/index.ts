/**
 * PR-ALG-15: Adaptive Explanation Layer
 *
 * Converts adaptive modifiers into human-readable explanations.
 * Read-only. Does not modify adaptive engine or session composer.
 */

export { generateAdaptiveExplanation, type AdaptiveExplanation } from './generateAdaptiveExplanation';
export { interpretModifier, type ExecutionSignals } from './modifierInterpreter';
export {
  EXPLANATION_TEMPLATES,
  type TemplateKey,
  type ExplanationTemplate,
} from './explanationTemplates';
