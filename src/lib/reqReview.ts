// Reviewing requirements.md answers the question one step before the plan's:
// **can this be planned?** Three things make a requirement document plannable,
// and none of them are visible reading the markdown top to bottom:
//
// 1. Every criterion answers a **user story** — and every story has criteria.
//    A story nobody wrote a criterion for is a promise the build will silently
//    drop; a criterion no story asks for is scope that arrived from nowhere.
// 2. Every criterion is in **EARS form** — one trigger, one observable outcome.
// 3. No criterion rests on a word that cannot be tested ("responsive", "easy
//    to use"). Those are the ones that come back as an argument at Ship.
//
// Story links are derived the same way the plan trace derives its own: a
// literal `US-2` in the line wins, otherwise shared distinctive vocabulary.

import { parseSpecDoc } from './specSections';
import { parseOpenQuestions } from './openQuestions';
import { bestMatches, buildTrace, extractCriteria } from './specTrace';

export interface UserStory {
  /** `US-1`… — the author's own id when the line carries one, else positional */
  id: string;
  role: string;
  want: string;
  why: string;
  /** the whole line, for the cases the shape didn't parse */
  text: string;
  criterionIds: string[];
}

export type EarsForm = 'WHEN / THEN' | 'WHILE / SHALL' | 'IF / THEN' | 'WHERE / SHALL' | 'not EARS';

export interface ReqCriterion {
  id: string;
  text: string;
  origin: string;
  form: EarsForm;
  /** the untestable words this criterion leans on, verbatim */
  vague: string[];
  storyId: string | null;
  /** true when the line names its story (`US-2`) rather than us inferring it */
  storyCited: boolean;
  /** where it lands in the plan, when there is one */
  planSections: string[];
  planTasks: string[];
}

export interface ReqReview {
  stories: UserStory[];
  criteria: ReqCriterion[];
  /** stories no criterion answers */
  orphanStories: string[];
  /** criteria that need a decision before planning (no story, or untestable) */
  flagged: string[];
  /** extra sections worth keeping in view while reviewing */
  scope: { title: string; items: string[] }[];
  questions: { open: number; resolved: number };
  /** true when the plan already exists, so the plan column means something */
  hasPlan: boolean;
  /**
   * Feature specs group criteria by the **user story** that asks for them. Bug
   * specs have no stories — their criteria group by the section they came from
   * (Expected Behavior, Unchanged Behavior), which is the same idea: what does
   * this criterion belong to.
   */
  storyMode: boolean;
}

const STORY_RE =
  /^as\s+(?:an?\s+|the\s+)?(.+?),?\s+i\s+want\s+(?:to\s+)?(.+?)(?:,?\s+so\s+that\s+(.+?))?\.?$/i;
const US_REF = /\bUS[-\s]?(\d{1,3})\b/gi;

/**
 * Words that read like a requirement but cannot be checked. Kept short and
 * literal on purpose: a long list flags honest prose and the reviewer starts
 * ignoring the flag, which is worse than not having it.
 */
const VAGUE = [
  'user-friendly',
  'user friendly',
  'easy to use',
  'intuitive',
  'seamless',
  'responsive',
  'snappy',
  'fast',
  'quickly',
  'performant',
  'efficient',
  'robust',
  'reliable',
  'appropriate',
  'appropriately',
  'reasonable',
  'as needed',
  'if necessary',
  'properly',
  'nicely',
  'modern',
  'clean',
  'simple',
  'several',
  'various',
  'etc',
];

function usRefs(text: string): string[] {
  return Array.from(text.matchAll(US_REF)).map((m) => `US-${Number(m[1])}`);
}

function formOf(text: string): EarsForm {
  const t = text.toUpperCase();
  if (/\bWHEN\b/.test(t) && /\bTHEN\b/.test(t) && /\bSHALL\b/.test(t)) return 'WHEN / THEN';
  if (/\bWHILE\b/.test(t) && /\bSHALL\b/.test(t)) return 'WHILE / SHALL';
  if (/\bIF\b/.test(t) && /\bTHEN\b/.test(t) && /\bSHALL\b/.test(t)) return 'IF / THEN';
  if (/\bWHERE\b/.test(t) && /\bSHALL\b/.test(t)) return 'WHERE / SHALL';
  return 'not EARS';
}

function vagueIn(text: string): string[] {
  const lower = text.toLowerCase();
  const found = VAGUE.filter((v) => new RegExp(`\\b${v.replace(/[-\s]/g, '[-\\s]')}\\b`).test(lower));
  // "easy to use" already covers "use"; keep the longest phrase of any overlap.
  return found.filter((v) => !found.some((o) => o !== v && o.includes(v)));
}

function extractStories(md: string): UserStory[] {
  const doc = parseSpecDoc(md);
  const out: UserStory[] = [];
  let n = 0;
  for (const section of doc.sections) {
    const isStorySection = /user stor/i.test(section.title);
    for (const item of section.items) {
      const m = STORY_RE.exec(item.text.replace(US_REF, '').replace(/^[\s:.—-]+/, '').trim());
      if (!m && !isStorySection) continue;
      if (!m) continue;
      n++;
      const own = usRefs(item.text)[0];
      out.push({
        id: own ?? `US-${n}`,
        role: m[1].trim(),
        want: m[2].trim(),
        why: (m[3] ?? '').trim(),
        text: item.text,
        criterionIds: [],
      });
    }
  }
  return out;
}

function sectionItems(md: string, match: RegExp): { title: string; items: string[] }[] {
  return parseSpecDoc(md)
    .sections.filter((s) => match.test(s.title))
    .map((s) => ({ title: s.title, items: s.items.map((i) => i.text) }))
    .filter((s) => s.items.length > 0);
}

/**
 * Everything the Requirements review needs. `planMd` is optional — before the
 * Plan gate there is nothing to point at, and the plan column stays empty
 * rather than pretending.
 */
export function reviewRequirements(
  requirementsMd: string,
  planMd?: string,
  tasksMd?: string
): ReqReview {
  const stories = extractStories(requirementsMd);
  const base = extractCriteria(requirementsMd);
  const hasPlan = Boolean(planMd && planMd.trim());
  const trace = hasPlan ? buildTrace(requirementsMd, planMd!, tasksMd) : null;

  const criteria: ReqCriterion[] = base.map((c) => {
    const cited = usRefs(c.text)[0];
    const known = cited && stories.some((s) => s.id === cited) ? cited : null;
    const storyId =
      known ??
      bestMatches(
        c.text,
        stories.map((s) => ({ id: s.id, text: `${s.role} ${s.want} ${s.why}` })),
        1
      )[0] ??
      null;
    const traced = trace?.criteria.find((t) => t.id === c.id);
    return {
      id: c.id,
      // A cited `US-2` is bookkeeping, not part of the sentence.
      text: c.text.replace(US_REF, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim(),
      origin: c.origin,
      form: formOf(c.text),
      vague: vagueIn(c.text),
      storyId,
      storyCited: Boolean(known),
      planSections: traced
        ? traced.sectionIds.map(
            (id) => trace!.sections.find((s) => s.id === id)?.title ?? id
          )
        : [],
      planTasks: traced?.taskIds ?? [],
    };
  });

  for (const c of criteria) {
    const s = stories.find((x) => x.id === c.storyId);
    if (s) s.criterionIds.push(c.id);
  }

  const q = parseOpenQuestions(requirementsMd).questions;
  const storyMode = stories.length > 0;

  return {
    stories,
    criteria,
    storyMode,
    orphanStories: stories.filter((s) => s.criterionIds.length === 0).map((s) => s.id),
    // "No story asks for this" is only a finding where stories exist at all.
    flagged: criteria
      .filter((c) => (storyMode && !c.storyId) || c.vague.length > 0 || c.form === 'not EARS')
      .map((c) => c.id),
    // Context worth keeping beside the criteria — minus any section that IS
    // criteria (a bug spec's Unchanged Behavior is already a group).
    scope: sectionItems(requirementsMd, /out of scope|non-functional|unchanged behavior/i).filter(
      (sec) => !criteria.some((c) => c.origin === sec.title)
    ),
    questions: { open: q.filter((x) => !x.resolved).length, resolved: q.filter((x) => x.resolved).length },
    hasPlan,
  };
}
