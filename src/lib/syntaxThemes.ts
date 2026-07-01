// Syntax color themes for the file viewer. Each theme is a flat map of 10 token
// "slots" — the same shape whether it's a built-in or a user-installed custom
// theme, so both apply identically by setting `--syn-*` CSS variables.

export interface SyntaxTheme {
  /** default text color */
  base: string;
  /** code background (use 'transparent' to inherit the panel) */
  bg: string;
  comment: string;
  punctuation: string;
  /** numbers, constants, booleans, tags */
  number: string;
  /** strings, chars, attr values */
  string: string;
  /** operators, urls, css values */
  operator: string;
  /** keywords, control flow */
  keyword: string;
  /** functions, class names */
  function: string;
  /** regex, variables, "important" */
  variable: string;
}

/** The editable slots, in display order — drives the custom-theme editor. */
export const THEME_SLOTS: { key: keyof SyntaxTheme; label: string }[] = [
  { key: 'base', label: 'Text' },
  { key: 'bg', label: 'Background' },
  { key: 'comment', label: 'Comment' },
  { key: 'keyword', label: 'Keyword' },
  { key: 'string', label: 'String' },
  { key: 'function', label: 'Function' },
  { key: 'number', label: 'Number' },
  { key: 'operator', label: 'Operator' },
  { key: 'variable', label: 'Variable' },
  { key: 'punctuation', label: 'Punctuation' },
];

export const BUILTIN_THEMES: { id: string; label: string; theme: SyntaxTheme }[] = [
  {
    id: 'abyss',
    label: 'Abyss (default)',
    theme: {
      base: '#e7ebf3',
      bg: 'transparent',
      comment: '#5b6781',
      punctuation: '#aab3c4',
      number: '#f78c6c',
      string: '#c3e88d',
      operator: '#89ddff',
      keyword: '#c792ea',
      function: '#82aaff',
      variable: '#ffcb6b',
    },
  },
  {
    id: 'dracula',
    label: 'Dracula',
    theme: {
      base: '#f8f8f2',
      bg: '#282a36',
      comment: '#6272a4',
      punctuation: '#f8f8f2',
      number: '#bd93f9',
      string: '#f1fa8c',
      operator: '#ff79c6',
      keyword: '#ff79c6',
      function: '#50fa7b',
      variable: '#ffb86c',
    },
  },
  {
    id: 'one-dark',
    label: 'One Dark',
    theme: {
      base: '#abb2bf',
      bg: '#282c34',
      comment: '#5c6370',
      punctuation: '#abb2bf',
      number: '#d19a66',
      string: '#98c379',
      operator: '#56b6c2',
      keyword: '#c678dd',
      function: '#61afef',
      variable: '#e06c75',
    },
  },
  {
    id: 'monokai',
    label: 'Monokai',
    theme: {
      base: '#f8f8f2',
      bg: '#272822',
      comment: '#75715e',
      punctuation: '#f8f8f2',
      number: '#ae81ff',
      string: '#e6db74',
      operator: '#f92672',
      keyword: '#f92672',
      function: '#a6e22e',
      variable: '#fd971f',
    },
  },
  {
    id: 'nord',
    label: 'Nord',
    theme: {
      base: '#d8dee9',
      bg: '#2e3440',
      comment: '#616e88',
      punctuation: '#eceff4',
      number: '#b48ead',
      string: '#a3be8c',
      operator: '#81a1c1',
      keyword: '#81a1c1',
      function: '#88c0d0',
      variable: '#d08770',
    },
  },
  {
    id: 'solarized-dark',
    label: 'Solarized Dark',
    theme: {
      base: '#93a1a1',
      bg: '#002b36',
      comment: '#586e75',
      punctuation: '#93a1a1',
      number: '#d33682',
      string: '#2aa198',
      operator: '#859900',
      keyword: '#859900',
      function: '#268bd2',
      variable: '#b58900',
    },
  },
  {
    id: 'github-light',
    label: 'GitHub Light',
    theme: {
      base: '#24292e',
      bg: '#ffffff',
      comment: '#6a737d',
      punctuation: '#24292e',
      number: '#005cc5',
      string: '#032f62',
      operator: '#d73a49',
      keyword: '#d73a49',
      function: '#6f42c1',
      variable: '#e36209',
    },
  },
];

export const DEFAULT_THEME_ID = 'abyss';

export function findBuiltin(id: string): SyntaxTheme | null {
  return BUILTIN_THEMES.find((t) => t.id === id)?.theme ?? null;
}

/** Convert a theme into the `--syn-*` CSS custom properties for a container. */
export function themeToCssVars(t: SyntaxTheme): React.CSSProperties {
  return {
    '--syn-base': t.base,
    '--syn-bg': t.bg,
    '--syn-comment': t.comment,
    '--syn-punct': t.punctuation,
    '--syn-num': t.number,
    '--syn-string': t.string,
    '--syn-operator': t.operator,
    '--syn-keyword': t.keyword,
    '--syn-function': t.function,
    '--syn-variable': t.variable,
  } as React.CSSProperties;
}
