import { Outlet } from 'react-router-dom';
import { Background } from './Background';
import { Nav } from './Nav';
import { Footer } from './Footer';

export function Layout() {
  return (
    <div className="relative min-h-screen">
      <Background />
      <Nav />
      <main className="pt-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
