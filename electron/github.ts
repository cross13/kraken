// GitHub REST client over the user's local GitHub CLI. Every call is
// `gh api …`, so authentication is whatever `gh auth login` set up — Octo
// stores no GitHub token of its own, and a user already signed in to `gh` has
// nothing to configure. Still dependency-free: gh is a binary on PATH.

import { spawn } from 'node:child_process';
import type {
  GitHubAuthStatus,
  GitHubOpResult,
  PrFile,
  PrReviewComment,
  PullRequestMeta,
} from './shared/types.js';
import { gitCurrentBranch, gitRemoteUrl } from './git.js';

/**
 * Environment for the `gh` subprocess. Electron's inherited PATH is too narrow
 * to find a Homebrew or ~/.local install, so main.ts hands over its expanded one.
 */
let ghEnv: NodeJS.ProcessEnv = process.env;
export function setGhEnv(env: NodeJS.ProcessEnv) {
  ghEnv = env;
}

interface GhRun {
  code: number | null;
  stdout: string;
  stderr: string;
  /** set when gh could not be started at all (ENOENT = not installed) */
  spawnError?: NodeJS.ErrnoException;
}

function runGh(args: string[], input?: string, timeoutMs = 60_000): Promise<GhRun> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = spawn('gh', args, {
      env: { ...ghEnv, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr, spawnError: e });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(input ?? '');
  });
}

const GH_MISSING = 'GitHub CLI (gh) not found. Install it from https://cli.github.com and run `gh auth login`.';

/** Parse owner/repo out of any common GitHub remote URL form. */
export function parseGitHubRemote(
  url: string | null
): { owner: string; repo: string } | null {
  if (!url) return null;
  let m: RegExpMatchArray | null;
  // git@github.com:owner/repo.git  /  ssh://git@github.com/owner/repo.git
  m = url.match(/github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  if (m) return { owner: m[1], repo: m[2] };
  return null;
}

/** Resolve owner/repo + current branch from a workspace dir. */
export function resolveRepo(cwd: string): {
  ok: boolean;
  owner?: string;
  repo?: string;
  remoteUrl?: string;
  branch?: string | null;
  error?: string;
} {
  const remoteUrl = gitRemoteUrl(cwd);
  const branch = gitCurrentBranch(cwd);
  if (!remoteUrl) {
    return { ok: false, branch, error: 'No `origin` remote configured for this workspace.' };
  }
  const parsed = parseGitHubRemote(remoteUrl);
  if (!parsed) {
    return {
      ok: false,
      remoteUrl,
      branch,
      error: 'The `origin` remote is not a github.com repository.',
    };
  }
  return { ok: true, owner: parsed.owner, repo: parsed.repo, remoteUrl, branch };
}

interface GhResponse<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/** One REST call through `gh api`. `path` is the REST path, query string included. */
async function ghFetch<T>(
  path: string,
  init: { method?: string; body?: string } = {}
): Promise<GhResponse<T>> {
  const args = [
    'api',
    path.replace(/^\//, ''),
    '--method',
    init.method ?? 'GET',
    '-H',
    'Accept: application/vnd.github+json',
    '-H',
    'X-GitHub-Api-Version: 2022-11-28',
  ];
  if (init.body) args.push('--input', '-');
  const run = await runGh(args, init.body);
  if (run.spawnError) {
    return {
      ok: false,
      status: 0,
      error: run.spawnError.code === 'ENOENT' ? GH_MISSING : run.spawnError.message,
    };
  }

  let body: unknown = null;
  if (run.stdout.trim()) {
    try {
      body = JSON.parse(run.stdout);
    } catch {
      body = run.stdout;
    }
  }
  if (run.code !== 0) {
    // gh prints the API's JSON error on stdout and `gh: … (HTTP 404)` on stderr.
    const status = Number(run.stderr.match(/HTTP (\d{3})/)?.[1] ?? 0);
    const msg =
      (body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : null) ??
      (run.stderr.trim().replace(/^gh:\s*/, '') || `GitHub CLI exited with ${run.code}.`);
    return { ok: false, status, error: msg };
  }
  return { ok: true, status: 200, data: body as T };
}

/** Is `gh` installed, and signed in as whom? Answers with the account gh will act as. */
export async function ghAuthStatus(): Promise<GitHubAuthStatus> {
  const run = await runGh(['api', 'user', '--jq', '.login'], undefined, 20_000);
  if (run.spawnError) {
    return run.spawnError.code === 'ENOENT'
      ? { installed: false, loggedIn: false, error: GH_MISSING }
      : { installed: false, loggedIn: false, error: run.spawnError.message };
  }
  if (run.code !== 0) {
    return {
      installed: true,
      loggedIn: false,
      error: run.stderr.trim().replace(/^gh:\s*/, '') || 'Not signed in — run `gh auth login`.',
    };
  }
  return { installed: true, loggedIn: true, login: run.stdout.trim() || undefined };
}

interface GhRepo {
  default_branch: string;
}

export async function ghDefaultBranch(
  owner: string,
  repo: string
): Promise<string | null> {
  const res = await ghFetch<GhRepo>(`/repos/${owner}/${repo}`);
  return res.ok ? res.data?.default_branch ?? null : null;
}

interface GhBranch {
  name: string;
}

/** List the repo's branches (remote) — the valid targets for a PR base. */
export async function ghListBranches(
  owner: string,
  repo: string
): Promise<GitHubOpResult<string[]>> {
  const res = await ghFetch<GhBranch[]>(`/repos/${owner}/${repo}/branches?per_page=100`
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: (res.data ?? []).map((b) => b.name) };
}

interface GhPull {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged_at: string | null;
  draft?: boolean;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
  user: { login: string } | null;
  created_at: string;
  updated_at: string;
}

function toPrMeta(p: GhPull): PullRequestMeta {
  return {
    number: p.number,
    title: p.title,
    body: p.body ?? '',
    state: p.state,
    merged: !!p.merged_at,
    draft: !!p.draft,
    url: p.html_url,
    head: p.head.ref,
    base: p.base.ref,
    author: p.user?.login ?? 'unknown',
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export async function ghListPullRequests(
  owner: string,
  repo: string,
  opts: { state?: 'open' | 'closed' | 'all'; head?: string } = {}
): Promise<GitHubOpResult<PullRequestMeta[]>> {
  const params = new URLSearchParams({
    state: opts.state ?? 'open',
    per_page: '50',
    sort: 'updated',
    direction: 'desc',
  });
  if (opts.head) params.set('head', `${owner}:${opts.head}`);
  const res = await ghFetch<GhPull[]>(`/repos/${owner}/${repo}/pulls?${params.toString()}`
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: (res.data ?? []).map(toPrMeta) };
}

export async function ghCreatePullRequest(
  owner: string,
  repo: string,
  params: { title: string; head: string; base: string; body?: string; draft?: boolean }
): Promise<GitHubOpResult<PullRequestMeta>> {
  const res = await ghFetch<GhPull>(`/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: params.title,
      head: params.head,
      base: params.base,
      body: params.body ?? '',
      draft: params.draft ?? false,
    }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: toPrMeta(res.data as GhPull) };
}

export async function ghMergePullRequest(
  owner: string,
  repo: string,
  number: number,
  method: 'merge' | 'squash' | 'rebase' = 'squash'
): Promise<GitHubOpResult<{ merged: boolean; message: string }>> {
  const res = await ghFetch<{ merged: boolean; message: string }>(`/repos/${owner}/${repo}/pulls/${number}/merge`,
    { method: 'PUT', body: JSON.stringify({ merge_method: method }) }
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

export async function ghGetPullRequest(
  owner: string,
  repo: string,
  number: number
): Promise<GitHubOpResult<PullRequestMeta & { headSha: string }>> {
  const res = await ghFetch<GhPull & { head: { ref: string; sha: string } }>(`/repos/${owner}/${repo}/pulls/${number}`
  );
  if (!res.ok || !res.data) return { ok: false, error: res.error };
  return { ok: true, data: { ...toPrMeta(res.data), headSha: res.data.head.sha } };
}

interface GhPrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

/**
 * The files a pull request changes, each with GitHub's own patch. Paged: the
 * endpoint caps at 100 per page and 3000 overall, so a large PR is read to the
 * end rather than reviewed from its first page.
 */
export async function ghPullRequestFiles(
  owner: string,
  repo: string,
  number: number
): Promise<GitHubOpResult<PrFile[]>> {
  const files: PrFile[] = [];
  for (let page = 1; page <= 30; page++) {
    const res = await ghFetch<GhPrFile[]>(`/repos/${owner}/${repo}/pulls/${number}/files?per_page=100&page=${page}`
    );
    if (!res.ok) return { ok: false, error: res.error };
    const batch = res.data ?? [];
    for (const f of batch) {
      files.push({
        path: f.filename,
        status: f.status,
        added: f.additions,
        deleted: f.deletions,
        patch: f.patch,
      });
    }
    if (batch.length < 100) break;
  }
  return { ok: true, data: files };
}

/**
 * Post a review. Always `COMMENT`: approving or requesting changes is a person's
 * call, and Octo never makes it on their behalf.
 */
export async function ghCreateReview(
  owner: string,
  repo: string,
  number: number,
  params: { body: string; commitId?: string; comments: PrReviewComment[] }
): Promise<GitHubOpResult<{ url: string }>> {
  const res = await ghFetch<{ html_url: string }>(`/repos/${owner}/${repo}/pulls/${number}/reviews`,
    {
      method: 'POST',
      body: JSON.stringify({
        body: params.body,
        event: 'COMMENT',
        ...(params.commitId ? { commit_id: params.commitId } : {}),
        comments: params.comments.map((c) => ({
          path: c.path,
          line: c.line,
          side: 'RIGHT',
          body: c.body,
        })),
      }),
    }
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: { url: res.data?.html_url ?? '' } };
}
