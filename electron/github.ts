// GitHub REST API client. Dependency-free (uses global fetch) so Octo can
// manage branches → pull requests without requiring the `gh` CLI. A Personal
// Access Token is supplied by the caller (main.ts stores it via safeStorage).

import type {
  GitHubOpResult,
  GitHubTokenStatus,
  PrFile,
  PrReviewComment,
  PullRequestMeta,
} from './shared/types.js';
import { gitCurrentBranch, gitRemoteUrl } from './git.js';

const API = 'https://api.github.com';
const UA = 'Octo-SDD';

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
  headers?: Headers;
}

async function ghFetch<T>(
  token: string,
  path: string,
  init: RequestInit = {}
): Promise<GhResponse<T>> {
  if (!token) return { ok: false, status: 0, error: 'No GitHub token configured.' };
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': UA,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : 'Network error reaching GitHub.',
    };
  }

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : null) ?? `GitHub API error (${res.status}).`;
    return { ok: false, status: res.status, error: msg, headers: res.headers };
  }
  return { ok: true, status: res.status, data: body as T, headers: res.headers };
}

interface GhUser {
  login: string;
}

/** Validate a token and report its login + scopes. */
export async function ghValidateToken(token: string): Promise<GitHubTokenStatus> {
  if (!token) return { hasToken: false };
  const res = await ghFetch<GhUser>(token, '/user');
  if (!res.ok) {
    return { hasToken: true, valid: false, error: res.error };
  }
  const scopeHeader = res.headers?.get('x-oauth-scopes') ?? '';
  const scopes = scopeHeader
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { hasToken: true, valid: true, login: res.data?.login, scopes };
}

interface GhRepo {
  default_branch: string;
}

export async function ghDefaultBranch(
  token: string,
  owner: string,
  repo: string
): Promise<string | null> {
  const res = await ghFetch<GhRepo>(token, `/repos/${owner}/${repo}`);
  return res.ok ? res.data?.default_branch ?? null : null;
}

interface GhBranch {
  name: string;
}

/** List the repo's branches (remote) — the valid targets for a PR base. */
export async function ghListBranches(
  token: string,
  owner: string,
  repo: string
): Promise<GitHubOpResult<string[]>> {
  const res = await ghFetch<GhBranch[]>(
    token,
    `/repos/${owner}/${repo}/branches?per_page=100`
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
  token: string,
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
  const res = await ghFetch<GhPull[]>(
    token,
    `/repos/${owner}/${repo}/pulls?${params.toString()}`
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: (res.data ?? []).map(toPrMeta) };
}

export async function ghCreatePullRequest(
  token: string,
  owner: string,
  repo: string,
  params: { title: string; head: string; base: string; body?: string; draft?: boolean }
): Promise<GitHubOpResult<PullRequestMeta>> {
  const res = await ghFetch<GhPull>(token, `/repos/${owner}/${repo}/pulls`, {
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
  token: string,
  owner: string,
  repo: string,
  number: number,
  method: 'merge' | 'squash' | 'rebase' = 'squash'
): Promise<GitHubOpResult<{ merged: boolean; message: string }>> {
  const res = await ghFetch<{ merged: boolean; message: string }>(
    token,
    `/repos/${owner}/${repo}/pulls/${number}/merge`,
    { method: 'PUT', body: JSON.stringify({ merge_method: method }) }
  );
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, data: res.data };
}

export async function ghGetPullRequest(
  token: string,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubOpResult<PullRequestMeta & { headSha: string }>> {
  const res = await ghFetch<GhPull & { head: { ref: string; sha: string } }>(
    token,
    `/repos/${owner}/${repo}/pulls/${number}`
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
  token: string,
  owner: string,
  repo: string,
  number: number
): Promise<GitHubOpResult<PrFile[]>> {
  const files: PrFile[] = [];
  for (let page = 1; page <= 30; page++) {
    const res = await ghFetch<GhPrFile[]>(
      token,
      `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100&page=${page}`
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
  token: string,
  owner: string,
  repo: string,
  number: number,
  params: { body: string; commitId?: string; comments: PrReviewComment[] }
): Promise<GitHubOpResult<{ url: string }>> {
  const res = await ghFetch<{ html_url: string }>(
    token,
    `/repos/${owner}/${repo}/pulls/${number}/reviews`,
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
