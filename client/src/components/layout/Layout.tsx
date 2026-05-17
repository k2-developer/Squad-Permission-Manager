import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import MobileNav from './MobileNav';

export default function Layout() {
  const [forceDesktop, setForceDesktop] = useState(() => {
    try { return localStorage.getItem('spm_desktop') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    if (forceDesktop) {
      meta.setAttribute('content', 'width=1280');
      try { localStorage.setItem('spm_desktop', '1'); } catch {}
    } else {
      meta.setAttribute('content', 'width=device-width, initial-scale=1.0');
      try { localStorage.removeItem('spm_desktop'); } catch {}
    }
  }, [forceDesktop]);

  // Force-desktop from mobile: render desktop-style
  if (forceDesktop) {
    return (
      <div className="min-h-screen bg-surface-950">
        <TopBar />
        <main className="mx-auto max-w-screen-2xl 3xl:max-w-screen-3xl 4xl:max-w-screen-4xl px-6 xl:px-10 py-6">
          <Outlet />
        </main>
        <button
          onClick={() => setForceDesktop(false)}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-surface-800 border border-surface-700 px-3 py-1.5 text-[10px] text-surface-400 hover:text-surface-200 shadow-lg lg:hidden"
        >
          Mobile version
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Desktop: top navbar */}
      <TopBar />

      {/* Content — centered with max-width for 2K/4K */}
      <main className="mx-auto max-w-screen-2xl 3xl:max-w-screen-3xl 4xl:max-w-screen-4xl px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 lg:py-8 pb-24 lg:pb-8">
        <Outlet />
      </main>

      {/* Mobile: bottom tabs */}
      <MobileNav onRequestDesktop={() => setForceDesktop(true)} />
    </div>
  );
}
