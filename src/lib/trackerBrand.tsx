// Which tracker a lane, tab or chip belongs to — at a glance.
//
// Octo lists work from several trackers side by side, and a label alone makes
// them a uniform grey list you have to *read* to tell apart. A mark plus the
// service's own hue is what turns "which of these is Jira?" into something the
// eye answers before the word is parsed.
//
// **These are the one place colour escapes the theme.** Every other colour in
// the app is `rgb(var(--x))` so the four palettes can swap it; a brand hue
// cannot be themed without ceasing to identify the thing it names — the same
// reason a favicon does not follow dark mode. They are chosen mid-tone so they
// hold on Signal's near-black and on Daylight's white, and they are only ever
// used at icon size next to a text label that already says the name, so they
// carry recognition rather than meaning.

import { Layers, Target, Waypoints, Github, Ticket, type LucideIcon } from 'lucide-react';
import type { TicketProviderConfig } from '../../electron/shared/types';

export interface TrackerBrand {
  Icon: LucideIcon;
  /** The service's own hue, or `null` to follow the surrounding text colour. */
  color: string | null;
}

/**
 * A brand per service, keyed by what the MCP server calls itself, then by
 * preset.
 *
 * The server name is checked first because it is more specific than the preset:
 * Linear and GitHub both come through as `generic`, and a generic tracker is
 * exactly the case where a label alone tells you least.
 */
const BY_SERVER: { match: RegExp; brand: TrackerBrand }[] = [
  { match: /atlassian|jira/i, brand: { Icon: Layers, color: '#2684FF' } },
  { match: /linear/i, brand: { Icon: Waypoints, color: '#7C89F0' } },
  { match: /github/i, brand: { Icon: Github, color: '#9AA4B2' } },
];

const BY_PRESET: Record<TicketProviderConfig['preset'], TrackerBrand> = {
  jira: { Icon: Layers, color: '#2684FF' },
  // The in-house tracker gets no foreign hue — it belongs to this app's world,
  // so it takes the theme accent and re-skins with everything else.
  tracker: { Icon: Target, color: null },
  generic: { Icon: Ticket, color: null },
};

export function trackerBrand(provider: {
  preset: TicketProviderConfig['preset'];
  server?: string;
  label?: string;
}): TrackerBrand {
  const hay = `${provider.server ?? ''} ${provider.label ?? ''}`;
  for (const { match, brand } of BY_SERVER) if (match.test(hay)) return brand;
  return BY_PRESET[provider.preset] ?? BY_PRESET.generic;
}

/**
 * The mark itself. `color: null` means "inherit", which is what lets the
 * tracker's own icon go dim in an inactive tab and light up in the active one
 * along with its label.
 */
export function TrackerMark({
  provider,
  size = 13,
  className,
}: {
  provider: { preset: TicketProviderConfig['preset']; server?: string; label?: string };
  size?: number;
  className?: string;
}) {
  const { Icon, color } = trackerBrand(provider);
  return (
    <Icon
      size={size}
      strokeWidth={2}
      className={className}
      style={color ? { color } : undefined}
      aria-hidden
    />
  );
}
