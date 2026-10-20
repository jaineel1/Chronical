import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useShellContext } from './shellContext';
import { useProfile } from '@/data/hooks';
import { useSyncState } from '@/data/syncState';
import { dayNumber, formatLongDate, todayKey } from '@/lib/dates';
import { ChestIcon, FireIcon, MapIcon, PeopleIcon, PersonIcon, SunIcon } from '@/ui/icons';
import { PixelSprite } from '@/ui/PixelSprite';
import { CAMPFIRE_LOGO_MAP, CAMPFIRE_LOGO_PALETTE } from '@/ui/sprites';

const NAV = [
  { to: '/', label: 'Morning', Icon: SunIcon, end: true },
  { to: '/map', label: 'Map', Icon: MapIcon },
  { to: '/campfire', label: 'Campfire', Icon: FireIcon },
  { to: '/you', label: 'You', Icon: PersonIcon },
  { to: '/vault', label: 'Vault', Icon: ChestIcon },
] as const;

const RAIL = [
  { to: '/', label: 'Morning', Icon: SunIcon, end: true },
  { to: '/map', label: 'Map', Icon: MapIcon },
  { to: '/campfire', label: 'Campfire', Icon: FireIcon },
  { to: '/you', label: 'You', Icon: PersonIcon },
  { to: '/people', label: 'People', Icon: PeopleIcon },
  { to: '/vault', label: 'Vault', Icon: ChestIcon },
] as const;

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Morning',
  '/campfire': 'Campfire',
  '/you': 'You',
  '/map': 'Map',
  '/people': 'People',
  '/progress': 'Progress',
  '/vault': 'Vault',
};

/**
 * The frame every screen sits in: dark ink bands top and bottom on phones, a dark rail on wide
 * screens. Content scrolls between them. Screens set the bar text with `useShellBar`.
 */
export function Shell() {
  const { bar } = useShellContext();
  const profile = useProfile();
  const location = useLocation();
  const sync = useSyncState();

  const routeTitle = ROUTE_TITLES[location.pathname] ?? (location.pathname.startsWith('/edit') ? 'Edit' : 'Chronicle');
  const title = bar?.title ?? routeTitle;
  const defaultMeta = profile?.startedAt ? `Day ${dayNumber(profile.startedAt, profile.settings.rolloverHour)}` : formatLongDate(todayKey());
  const meta = bar?.meta ?? defaultMeta;

  return (
    <div className="flex min-h-dvh bg-paper text-ink">
      {/* Desktop rail */}
      <nav aria-label="Main" className="hidden w-24 shrink-0 flex-col items-center bg-ink pt-6 pb-5 lg:flex">
        <PixelSprite map={CAMPFIRE_LOGO_MAP} palette={CAMPFIRE_LOGO_PALETTE} scale={3} className="mb-7" />
        {RAIL.map(({ to, label, Icon, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={'end' in rest ? rest.end : false}
            className={({ isActive }) =>
              `flex h-[60px] w-24 flex-col items-center justify-center gap-1 border-l-[3px] no-underline ${
                isActive ? 'border-paper text-paper' : 'border-transparent text-bar-muted hover:text-paper'
              }`
            }
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
        <div className="mt-auto text-center leading-[1.4] text-bar-muted">
          Local
          <br />
          first
        </div>
      </nav>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="flex items-baseline justify-between gap-4 bg-ink px-6 py-3.5 text-paper lg:px-10">
          <span className="truncate">{title}</span>
          {meta ? <span className="shrink-0 text-bar-text">{meta}</span> : null}
        </header>
        {sync.linked && sync.error && location.pathname !== '/sync' && location.pathname !== '/vault/sync' ? (
          <Link to="/sync" className="bg-paper-2 px-6 py-1.5 text-red no-underline lg:px-10" data-testid="sync-failed">
            Sync failed: {sync.error}
          </Link>
        ) : null}

        <main className="flex min-h-0 flex-1 flex-col pb-[calc(env(safe-area-inset-bottom)+72px)] lg:pb-8">
          <Outlet />
        </main>

        {/* Phone bottom bar */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-20 flex justify-between bg-ink px-4 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {NAV.map(({ to, label, Icon, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest ? rest.end : false}
              className={({ isActive }) =>
                `flex w-[68px] flex-col items-center gap-1 border-t-[3px] pt-2 pb-3 no-underline ${
                  isActive ? 'border-paper text-paper' : 'border-transparent text-bar-muted'
                }`
              }
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}

/** Standard page body: gutter padding, vertical rhythm, optional max width on desktop. */
export function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className={`flex w-full flex-col gap-2 px-6 pt-2.5 pb-4 lg:px-10 lg:pt-6 ${wide ? '' : 'lg:max-w-[760px]'}`}>{children}</div>;
}
