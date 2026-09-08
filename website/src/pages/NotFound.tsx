import { Link } from 'react-router-dom';
import { OctoMark } from '../components/Octo';

export function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-6 px-5 text-center">
      <OctoMark className="h-20 w-20" detail="full" />
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-600">404</div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-50">
          Nothing at this path.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-400">
          The page you asked for is not part of the site. The loop, however, is still where you left
          it.
        </p>
      </div>
      <Link
        to="/"
        className="bg-accent px-5 py-3 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hi"
      >
        Back home
      </Link>
    </div>
  );
}
