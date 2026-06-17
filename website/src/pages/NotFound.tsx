import { Link } from 'react-router-dom';
import { KrakenLogo } from '../components/KrakenLogo';
import { Section } from '../components/ui';

export function NotFound() {
  return (
    <Section className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="relative h-24 w-24 text-accent/40">
        <div className="absolute inset-4 rounded-full bg-accent/15 blur-2xl" />
        <KrakenLogo className="relative h-full w-full animate-floaty" />
      </div>
      <h1 className="mt-6 font-display text-6xl font-semibold text-ink-50">404</h1>
      <p className="mt-3 max-w-sm text-ink-400">
        This page slipped into the abyss. Let’s get you back to the surface.
      </p>
      <Link
        to="/"
        className="mt-7 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
      >
        Back to home
      </Link>
    </Section>
  );
}
