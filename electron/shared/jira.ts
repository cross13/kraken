// Atlassian's tool names, pinned rather than discovered — and shared, because
// both the main process (building the calls) and the renderer (showing the
// mapping) need exactly the same list, and two copies would drift silently.
//
// Discovery is actively unsafe for Jira. The heuristic `['transition']` matches
// both `transitionJiraIssue` (a write) and `getTransitionsForJiraIssue` (a
// read), and `['get','issue']` matches `getJiraIssue`,
// `getJiraIssueRemoteIssueLinks` and `getJiraIssueTypeMetaWithFields`; the
// matcher takes the first in `tools/list` order, so a server-side reordering
// would repoint a write capability at a read tool with nothing to notice it.
// `getVisibleJiraProjects` has no `list` in its name and would map to nothing.

import type { TicketCapability } from './types.js';

export const JIRA_TOOLS: Partial<Record<TicketCapability, string>> = {
  create: 'createJiraIssue',
  search: 'searchJiraIssuesUsingJql',
  get: 'getJiraIssue',
  comment: 'addCommentToJiraIssue',
  transition: 'transitionJiraIssue',
  scopes: 'getAccessibleAtlassianResources',
};

/** Read-only; tells us which transition id means which status in this workflow. */
export const JIRA_TRANSITIONS_TOOL = 'getTransitionsForJiraIssue';
