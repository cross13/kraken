import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../stores/workspace';
import { buildSteps, type Step } from './quickStart';

/**
 * Quick Start's checklist, read live — shared by Quick Start itself and by the
 * guides, whose green checks must mean exactly what Quick Start's do.
 */
export function useSetupSteps(): { steps: Step[]; refresh: () => Promise<void> } {
  const root = useWorkspace((s) => s.root);
  const agents = useWorkspace((s) => s.agents);
  const skills = useWorkspace((s) => s.skills);
  const steering = useWorkspace((s) => s.steering);
  const specs = useWorkspace((s) => s.specs);

  const [backend, setBackend] = useState<'cli' | 'api'>('cli');
  const [cli, setCli] = useState<{ found: boolean; version?: string }>({ found: false });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [trackers, setTrackers] = useState(0);

  const refresh = useCallback(async () => {
    const [b, c, k] = await Promise.all([
      window.octo.settings.getBackend().catch(() => 'cli' as const),
      window.octo.cli.detect().catch(() => ({ found: false })),
      window.octo.settings.hasApiKey().catch(() => false),
    ]);
    setBackend(b);
    setCli(c);
    setHasApiKey(k);
    if (root) {
      const p = await window.octo.tickets.listProviders(root).catch(() => []);
      setTrackers(p.filter((x) => x.enabled).length);
    }
  }, [root]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const steps = useMemo(
    () =>
      buildSteps({
        root,
        backend,
        cliFound: cli.found,
        cliVersion: cli.version,
        hasApiKey,
        agents,
        skills,
        steering,
        specs,
        trackers,
      }),
    [root, backend, cli, hasApiKey, agents, skills, steering, specs, trackers]
  );

  return { steps, refresh };
}
