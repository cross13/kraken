import { useEffect, useState } from 'react';

export function FileViewer({ path }: { path: string }) {
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.kraken.fs
      .read(path)
      .then(setContent)
      .catch((e) => setError(String(e)));
  }, [path]);

  if (error) return <div className="p-6 text-sm text-bad">{error}</div>;

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <div className="border-b border-ink-800 px-6 py-3 text-[11px] text-ink-500 font-mono truncate">
        {path}
      </div>
      <pre className="flex-1 overflow-auto code-input bg-ink-950 text-ink-200 px-8 py-6 m-0">
        {content}
      </pre>
    </div>
  );
}
