/**
 * Is this document still the untouched template?
 *
 * Creating a spec writes a template to disk, so "has content" is not the same
 * as "has been written". The gate bar needs the difference: a stub gets *Draft
 * with Claude* as its primary action, a real document gets *Approve*.
 *
 * Detection is by the literal `<placeholder>` tokens the templates in
 * `electron/main.ts` ship with — a draft, by hand or by Claude, replaces them.
 * A false positive is harmless: Approve stays available, it just isn't primary.
 */
const STUB_PLACEHOLDERS = [
  // requirements.md
  '<role>',
  '<capability>',
  '<event/trigger>',
  '<precondition>',
  '<unresolved decision or ambiguity to settle before design>',
  // bugfix.md
  '<step>',
  '<condition>',
  '<incorrect behavior>',
  // plan.md / tasks.md
  '<S / M / L>',
  'path/to/file.ts:42',
  '<smallest verifiable change>',
  '<a decision only the user can make>',
];

export function isStubDoc(md: string): boolean {
  const t = md.trim();
  if (!t) return true;
  return STUB_PLACEHOLDERS.some((p) => t.includes(p));
}
