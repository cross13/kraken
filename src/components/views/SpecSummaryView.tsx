import { useEffect, useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import { useWorkspace } from '../../stores/workspace';
import { CompletionSummary } from './CompletionSummary';
import type { SpecMeta } from '../../../electron/shared/types';

/**
 * Dedicated tab (OpenTab kind 'summary') for a spec's completion recap — the
 * changed-files list + AI-generated description. Moved out of the Tasks board so
 * the board stays a focused runner.
 */
export function SpecSummaryView({ specId }: { specId: string }) {
  const root = useWorkspace((s) => s.root)!;
  const [meta, setMeta] = useState<SpecMeta | null>(null);

  useEffect(() => {
    let alive = true;
    window.kraken.specs
      .read(root, specId)
      .then((r) => alive && setMeta(r.meta))
      .catch(() => alive && setMeta(null));
    return () => {
      alive = false;
    };
  }, [root, specId]);

  if (!meta) return <div className="p-6 text-sm text-dim">Loading summary…</div>;

  const specRel = meta.path.replace(root + '/', '');

  return (
    <div className="h-full overflow-y-auto bg-ink-950">
      <div className="max-w-[920px] mx-auto px-8 py-9">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 grid place-items-center rounded-xl bg-ok/[0.16] text-ok shrink-0">
            <FileCheck2 size={18} />
          </div>
          <div>
            <h1 className="font-display text-[24px] font-bold text-ink-50 leading-tight">
              {meta.name}
            </h1>
            <p className="font-mono text-[11px] text-faint">completion summary · files changed</p>
          </div>
        </div>
        <p className="text-[13px] text-dim leading-relaxed mb-6 mt-3">
          Everything this spec changed across its runs, with an optional AI recap. Generated content
          is saved to <code className="md-codespan">summary.md</code>.
        </p>
        <CompletionSummary meta={meta} specRel={specRel} />
      </div>
    </div>
  );
}
