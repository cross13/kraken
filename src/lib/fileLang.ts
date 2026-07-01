// Map a filename to a Prism language id. Used by the file viewer to decide how
// to highlight a file, and by the Syntax studio to show extension associations.

interface LangInfo {
  id: string;
  label: string;
}

// Prism language id → human label + the extensions that select it.
const EXT_TO_LANG: Record<string, LangInfo> = {
  // web / core
  ts: { id: 'typescript', label: 'TypeScript' },
  tsx: { id: 'tsx', label: 'TSX' },
  js: { id: 'javascript', label: 'JavaScript' },
  jsx: { id: 'jsx', label: 'JSX' },
  mjs: { id: 'javascript', label: 'JavaScript' },
  cjs: { id: 'javascript', label: 'JavaScript' },
  json: { id: 'json', label: 'JSON' },
  jsonc: { id: 'json', label: 'JSON' },
  html: { id: 'markup', label: 'HTML' },
  htm: { id: 'markup', label: 'HTML' },
  xml: { id: 'markup', label: 'XML' },
  svg: { id: 'markup', label: 'SVG' },
  vue: { id: 'markup', label: 'Vue' },
  css: { id: 'css', label: 'CSS' },
  scss: { id: 'scss', label: 'SCSS' },
  sass: { id: 'sass', label: 'Sass' },
  less: { id: 'less', label: 'Less' },
  // config / data
  yaml: { id: 'yaml', label: 'YAML' },
  yml: { id: 'yaml', label: 'YAML' },
  toml: { id: 'toml', label: 'TOML' },
  ini: { id: 'ini', label: 'INI' },
  env: { id: 'bash', label: 'Dotenv' },
  md: { id: 'markdown', label: 'Markdown' },
  markdown: { id: 'markdown', label: 'Markdown' },
  sql: { id: 'sql', label: 'SQL' },
  graphql: { id: 'graphql', label: 'GraphQL' },
  gql: { id: 'graphql', label: 'GraphQL' },
  proto: { id: 'protobuf', label: 'Protobuf' },
  diff: { id: 'diff', label: 'Diff' },
  patch: { id: 'diff', label: 'Diff' },
  // shell
  sh: { id: 'bash', label: 'Shell' },
  bash: { id: 'bash', label: 'Bash' },
  zsh: { id: 'bash', label: 'Zsh' },
  fish: { id: 'bash', label: 'Fish' },
  ps1: { id: 'powershell', label: 'PowerShell' },
  // systems / compiled
  rs: { id: 'rust', label: 'Rust' },
  go: { id: 'go', label: 'Go' },
  c: { id: 'c', label: 'C' },
  h: { id: 'c', label: 'C header' },
  cpp: { id: 'cpp', label: 'C++' },
  cc: { id: 'cpp', label: 'C++' },
  cxx: { id: 'cpp', label: 'C++' },
  hpp: { id: 'cpp', label: 'C++ header' },
  cs: { id: 'csharp', label: 'C#' },
  java: { id: 'java', label: 'Java' },
  kt: { id: 'kotlin', label: 'Kotlin' },
  kts: { id: 'kotlin', label: 'Kotlin' },
  swift: { id: 'swift', label: 'Swift' },
  scala: { id: 'scala', label: 'Scala' },
  dart: { id: 'dart', label: 'Dart' },
  m: { id: 'objectivec', label: 'Objective-C' },
  groovy: { id: 'groovy', label: 'Groovy' },
  // scripting
  py: { id: 'python', label: 'Python' },
  rb: { id: 'ruby', label: 'Ruby' },
  php: { id: 'php', label: 'PHP' },
  lua: { id: 'lua', label: 'Lua' },
  pl: { id: 'perl', label: 'Perl' },
  r: { id: 'r', label: 'R' },
  ex: { id: 'elixir', label: 'Elixir' },
  exs: { id: 'elixir', label: 'Elixir' },
  hs: { id: 'haskell', label: 'Haskell' },
  clj: { id: 'clojure', label: 'Clojure' },
};

// Files with no (useful) extension, matched by exact name.
const NAME_TO_LANG: Record<string, LangInfo> = {
  dockerfile: { id: 'docker', label: 'Dockerfile' },
  makefile: { id: 'makefile', label: 'Makefile' },
  '.gitignore': { id: 'bash', label: 'Gitignore' },
  '.env': { id: 'bash', label: 'Dotenv' },
  '.npmrc': { id: 'ini', label: 'INI' },
};

/** Best-guess language for a file path/name, or null when there's no match. */
export function detectLanguage(pathOrName: string): LangInfo | null {
  const name = pathOrName.split(/[/\\]/).pop() ?? pathOrName;
  const lower = name.toLowerCase();
  if (NAME_TO_LANG[lower]) return NAME_TO_LANG[lower];
  const dot = lower.lastIndexOf('.');
  if (dot === -1) return null;
  const ext = lower.slice(dot + 1);
  return EXT_TO_LANG[ext] ?? null;
}
