/// <reference types="vite/client" />
// The guides, as the app reads them — the same `guides/<lang>/*.md` the public
// site renders, bundled at build time (no IPC: it is the app's own content, not
// the workspace's). What the app adds over the site is *where you are*: the
// screen a guide is about, the `?` that finds it, and a check against real state.

import {
  GUIDE_CHECKS,
  GUIDE_GOTOS,
  loadGuides,
  type Guide,
  type GuideGoto,
  type GuideLang,
} from '../../guides/guides';
import type { StepId } from './quickStart';
import { useUi, type ActivityTab, type LibrarySection, type SpecStage } from '../stores/ui';

// Compile-time guard that the format's vocabulary still names real screens and
// real Quick Start steps — a rename in `ui.ts` breaks this line, not a click.
type Dest = 'home' | `spec:${SpecStage}` | `activity:${ActivityTab}` | `library:${LibrarySection}`;
GUIDE_GOTOS satisfies readonly Dest[];
GUIDE_CHECKS satisfies readonly StepId[];

export const GUIDES = loadGuides(
  import.meta.glob('../../guides/*/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
    string,
    string
  >
);

/** The screen on display right now, in the guides' vocabulary. */
export function currentGoto(): GuideGoto {
  const s = useUi.getState();
  if (s.surface === 'spec') return `spec:${s.specStage}`;
  if (s.surface === 'activity') return `activity:${s.activityTab}`;
  if (s.surface === 'library') return `library:${s.librarySection}`;
  // Home, and Learn — which is itself the guide, so its `?` starts the path.
  return 'home';
}

/**
 * The guides about a screen: exact matches first, then the rest of its surface
 * (`library:hooks` falls back to any Library guide), start track before how-tos.
 */
export function guidesFor(goto: GuideGoto, lang: GuideLang): Guide[] {
  const list = GUIDES.byLang[lang];
  const surface = goto.split(':')[0];
  const exact = list.filter((g) => g.goto === goto);
  const near = list.filter((g) => g.goto !== goto && g.goto.split(':')[0] === surface);
  return [...exact, ...near];
}

/**
 * *Take me there*. A spec stage needs a spec: with one open it switches stage,
 * otherwise it lands on Home, where specs are started and picked.
 */
export function goTo(goto: GuideGoto) {
  const ui = useUi.getState();
  const [surface, sub] = goto.split(':') as [string, string | undefined];
  ui.closeOverlay();
  if (surface === 'spec') {
    if (ui.activeSpecId) ui.openSpec(ui.activeSpecId, sub as SpecStage);
    else ui.setSurface('home');
  } else if (surface === 'activity') ui.openActivity(sub as ActivityTab);
  else if (surface === 'library') ui.openLibrary(sub as LibrarySection);
  else ui.setSurface('home');
}

export const GUIDE_CHROME: Record<GuideLang, Record<string, string>> = {
  en: {
    guides: 'Guides',
    start: 'Start here',
    howto: 'How to',
    takeMe: 'Take me there',
    done: 'Done in this workspace',
    next: 'Next',
    min: 'min',
    noSpec: 'Opens Home — this step needs a spec open.',
  },
  es: {
    guides: 'Guías',
    start: 'Empezá acá',
    howto: 'Cómo hacer',
    takeMe: 'Llevame ahí',
    done: 'Hecho en este workspace',
    next: 'Siguiente',
    min: 'min',
    noSpec: 'Abre Home — este paso necesita un spec abierto.',
  },
};
