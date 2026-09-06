// What this spec still owes its ticket.
//
// The obvious design is to fire an event at each call site — on approve, on
// branch, on PR. This derives the same list from the spec's *state* instead,
// and it is the better one: nothing is lost because the app was closed at the
// wrong moment, re-opening a phase cannot double-post (the ticket records which
// events it has already applied), and a spec linked halfway through catches up
// on everything at once instead of starting from wherever it happened to be.

import type { SpecMeta } from '../../electron/shared/types';
import { extractCriteria } from './specTrace';

export type SyncEvent =
  | { kind: 'spec-created' }
  | { kind: 'plan-approved'; plan: string; criteria: string[] }
  | { kind: 'phase-advanced'; phase: string }
  | { kind: 'branch-created'; branch: string }
  | { kind: 'pr-opened'; url: string; number?: number }
  | { kind: 'spec-done'; summary?: string };

/** Mirrors `eventId` in `electron/tickets.ts` — the two must agree. */
export function syncEventId(ev: SyncEvent): string {
  switch (ev.kind) {
    case 'phase-advanced':
      return `phase-advanced:${ev.phase}`;
    case 'branch-created':
      return `branch-created:${ev.branch}`;
    case 'pr-opened':
      return `pr-opened:${ev.url}`;
    default:
      return ev.kind;
  }
}

const PHASE_ORDER = ['requirements', 'plan', 'build', 'done'];

/**
 * Everything that has happened to this spec that the tracker has not been told
 * about yet, oldest first. An unlinked spec offers only the one event that can
 * create the link.
 */
export function pendingEvents(
  meta: SpecMeta,
  files: { plan?: string; requirements?: string; bugfix?: string },
  summary?: string
): SyncEvent[] {
  const applied = new Set(meta.ticket?.applied ?? []);
  const out: SyncEvent[] = [];

  if (!meta.ticket?.key) return [{ kind: 'spec-created' }];

  const phaseIdx = PHASE_ORDER.indexOf(meta.phase);
  const planApproved = phaseIdx >= PHASE_ORDER.indexOf('build');

  if (planApproved && files.plan?.trim()) {
    out.push({
      kind: 'plan-approved',
      plan: files.plan,
      criteria: extractCriteria(files.requirements ?? files.bugfix ?? '').map(
        (c) => `${c.id} ${c.text}`
      ),
    });
  }
  if (meta.branch) out.push({ kind: 'branch-created', branch: meta.branch });
  if (meta.prUrl) out.push({ kind: 'pr-opened', url: meta.prUrl, number: meta.prNumber });
  if (meta.phase === 'done') out.push({ kind: 'spec-done', summary });

  return out.filter((ev) => !applied.has(syncEventId(ev)));
}

/** A short label for an event, for the pending list. */
export function eventLabel(ev: SyncEvent): string {
  switch (ev.kind) {
    case 'spec-created':
      return 'Create the ticket';
    case 'plan-approved':
      return `Publish the plan and ${ev.criteria.length} criteria`;
    case 'phase-advanced':
      return `Note that ${ev.phase} was approved`;
    case 'branch-created':
      return `Link branch ${ev.branch}`;
    case 'pr-opened':
      return 'Link the pull request';
    case 'spec-done':
      return 'Move it to review';
  }
}
