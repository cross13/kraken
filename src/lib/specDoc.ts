/**
 * Is this document still the untouched template?
 *
 * The gate bar needs the difference between "has content" and "has been
 * written": a stub gets *Draft with Claude* as its primary action, a real
 * document gets *Approve*.
 *
 * **New specs start empty**, so for them this is just "is it blank". The
 * `<placeholder>` list below is the legacy path: specs created before Octo
 * stopped writing templates still carry those tokens on disk, and they are
 * still stubs. A false positive is harmless — Approve stays available, it just
 * isn't primary.
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
