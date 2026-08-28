import { useEffect, useState } from 'react';
import { Bot } from 'lucide-react';
import { Markdown } from '../Markdown';

export function AgentViewer({ path }: { path: string }) {
  const [content, setContent] = useState('');
  useEffect(() => {
    window.kraken.agents.read(path).then(setContent);
  }, [path]);

  return (
    <div className="h-full overflow-y-auto bg-ink-950">
      <div className="k-read py-6">
        <div className="flex items-center gap-2 text-ink-400 text-[11px] mb-4">
          <Bot size={13} className="text-accent" />
          <span className="font-mono">{path}</span>
        </div>
        <Markdown source={content} />
      </div>
    </div>
  );
}
