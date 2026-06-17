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
