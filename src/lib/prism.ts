// Centralised Prism setup. Imported once at app startup; all later modules
// (markdown renderer + code editor) reuse this configured Prism instance.

import Prism from 'prismjs';

// Languages — order matters: some grammars depend on others (tsx → typescript,
// typescript → javascript). We import in dependency order.
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-shell-session';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-diff';

export { Prism };

// Map shorthand or alternative names to actual Prism language IDs.
const ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'shell-session',
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rs: 'rust',
  yml: 'yaml',
  md: 'markdown',
  html: 'markup',
  xml: 'markup',
};

export function resolveLang(lang: string | undefined): string {
  if (!lang) return 'plain';
  const key = lang.toLowerCase().trim();
  return ALIASES[key] ?? key;
}

// ── Installable languages ────────────────────────────────────────────────────
// Core grammars above are always bundled. These extra ones load on demand (each
// a separate Vite chunk) so we don't ship every grammar up front; the user
// "installs" the ones they need from the Syntax module. Prism components
// self-register into the shared Prism instance on import.

export interface LangSpec {
  id: string;
  label: string;
  /** grammars that must load first (some Prism components depend on others) */
  deps?: string[];
  /** hidden = an internal dependency, not shown as an installable language */
  hidden?: boolean;
}

// Static import strings so Vite can code-split each grammar into its own chunk.
const LOADERS: Record<string, () => Promise<unknown>> = {
  'markup-templating': () => import('prismjs/components/prism-markup-templating'),
  java: () => import('prismjs/components/prism-java'),
  c: () => import('prismjs/components/prism-c'),
  cpp: () => import('prismjs/components/prism-cpp'),
  csharp: () => import('prismjs/components/prism-csharp'),
  objectivec: () => import('prismjs/components/prism-objectivec'),
  php: () => import('prismjs/components/prism-php'),
  ruby: () => import('prismjs/components/prism-ruby'),
  kotlin: () => import('prismjs/components/prism-kotlin'),
  swift: () => import('prismjs/components/prism-swift'),
  scala: () => import('prismjs/components/prism-scala'),
  groovy: () => import('prismjs/components/prism-groovy'),
  dart: () => import('prismjs/components/prism-dart'),
  lua: () => import('prismjs/components/prism-lua'),
  perl: () => import('prismjs/components/prism-perl'),
  r: () => import('prismjs/components/prism-r'),
  haskell: () => import('prismjs/components/prism-haskell'),
  elixir: () => import('prismjs/components/prism-elixir'),
  clojure: () => import('prismjs/components/prism-clojure'),
  powershell: () => import('prismjs/components/prism-powershell'),
  toml: () => import('prismjs/components/prism-toml'),
  ini: () => import('prismjs/components/prism-ini'),
  scss: () => import('prismjs/components/prism-scss'),
  sass: () => import('prismjs/components/prism-sass'),
  less: () => import('prismjs/components/prism-less'),
  graphql: () => import('prismjs/components/prism-graphql'),
  protobuf: () => import('prismjs/components/prism-protobuf'),
  docker: () => import('prismjs/components/prism-docker'),
  makefile: () => import('prismjs/components/prism-makefile'),
};

const DEPS: Record<string, string[]> = {
  cpp: ['c'],
  objectivec: ['c'],
  scala: ['java'],
  php: ['markup-templating'],
  scss: ['css'],
  less: ['css'],
};

/** Extra languages the user can install, with display labels. */
export const INSTALLABLE_LANGUAGES: LangSpec[] = [
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++', deps: ['c'] },
  { id: 'csharp', label: 'C#' },
  { id: 'objectivec', label: 'Objective-C', deps: ['c'] },
  { id: 'php', label: 'PHP', deps: ['markup-templating'] },
  { id: 'ruby', label: 'Ruby' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'swift', label: 'Swift' },
  { id: 'scala', label: 'Scala', deps: ['java'] },
  { id: 'groovy', label: 'Groovy' },
  { id: 'dart', label: 'Dart' },
  { id: 'lua', label: 'Lua' },
  { id: 'perl', label: 'Perl' },
  { id: 'r', label: 'R' },
  { id: 'haskell', label: 'Haskell' },
  { id: 'elixir', label: 'Elixir' },
  { id: 'clojure', label: 'Clojure' },
  { id: 'powershell', label: 'PowerShell' },
  { id: 'toml', label: 'TOML' },
  { id: 'ini', label: 'INI' },
  { id: 'scss', label: 'SCSS', deps: ['css'] },
  { id: 'sass', label: 'Sass' },
  { id: 'less', label: 'Less' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'protobuf', label: 'Protobuf' },
  { id: 'docker', label: 'Dockerfile' },
  { id: 'makefile', label: 'Makefile' },
];

/** Core grammars that are always available (statically bundled above). */
export const CORE_LANGUAGES: LangSpec[] = [
  { id: 'markup', label: 'HTML / XML' },
  { id: 'css', label: 'CSS' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'jsx', label: 'JSX' },
  { id: 'tsx', label: 'TSX' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'bash', label: 'Bash / Shell' },
  { id: 'python', label: 'Python' },
  { id: 'rust', label: 'Rust' },
  { id: 'go', label: 'Go' },
  { id: 'sql', label: 'SQL' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'diff', label: 'Diff' },
];

const loaded = new Set<string>();
const inflight = new Map<string, Promise<boolean>>();

/** True if the grammar is available right now (no loading needed). */
export function isLanguageReady(lang: string | undefined): boolean {
  const id = resolveLang(lang);
  return !!Prism.languages[id];
}

/** Is this an extra (installable) language rather than a bundled core one? */
export function isInstallable(lang: string | undefined): boolean {
  const id = resolveLang(lang);
  return id in LOADERS && !isCore(id);
}

function isCore(id: string): boolean {
  return CORE_LANGUAGES.some((l) => l.id === id);
}

/**
 * Ensure a grammar (and its dependencies) is loaded. Returns whether the grammar
 * is available afterwards. Idempotent + de-duplicated across concurrent callers.
 */
export async function ensureLanguage(lang: string | undefined): Promise<boolean> {
  const id = resolveLang(lang);
  if (Prism.languages[id]) return true;
  if (loaded.has(id)) return !!Prism.languages[id];
  const load = LOADERS[id];
  if (!load) return false;
  if (inflight.has(id)) return inflight.get(id)!;
  const p = (async () => {
    for (const dep of DEPS[id] ?? []) await ensureLanguage(dep);
    try {
      await load();
      loaded.add(id);
    } catch {
      // grammar failed to load — fall back to plain text
    }
    return !!Prism.languages[id];
  })();
  inflight.set(id, p);
  const ok = await p;
  inflight.delete(id);
  return ok;
}

export function highlight(code: string, lang: string): string {
  const id = resolveLang(lang);
  const grammar = Prism.languages[id];
  if (!grammar) return escapeHtml(code);
  return Prism.highlight(code, grammar, id);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
