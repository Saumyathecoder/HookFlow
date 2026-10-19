import {
  LayoutDashboard,
  Webhook,
  Zap,
  ShieldAlert,
  LogOut,
} from 'lucide-react';
import { clearKey } from '../lib/api';

type Page = 'overview' | 'webhooks' | 'events' | 'dlq';

interface SidebarProps {
  current: Page;
  onChange: (page: Page) => void;
}

const links = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'events', label: 'Fire Event', icon: Zap },
  { id: 'dlq', label: 'Failed Deliveries', icon: ShieldAlert },
] as const;

export function Sidebar({ current, onChange }: SidebarProps) {
  function logout() {
    clearKey();
    window.location.reload();
  }

  return (
    <aside className="fixed bottom-0 left-0 top-0 flex w-56 flex-col bg-[#0a0a0c] ring-1 ring-white/5">
      {/* Brand */}
      <div className="px-5 pb-6 pt-7">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400">
            <Webhook size={18} className="text-zinc-950" />
          </div>
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight text-white">
              Hook<span className="text-cyan-400">Flow</span>
            </p>
            <p className="text-[10px] uppercase tracking-widest text-zinc-600">Delivery Console</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <p className="mb-3 px-3 text-[11px] uppercase tracking-widest text-zinc-600">Workspace</p>

        <div className="space-y-1">
          {links.map(({ id, label, icon: Icon }) => {
            const active = current === id;
            return (
              <button
                key={id}
                onClick={() => onChange(id as Page)}
                className={`relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition ${
                  active
                    ? 'bg-white/[0.05] font-medium text-white'
                    : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200'
                }`}
              >
                {active && (
                  <span className="absolute bottom-2.5 left-0 top-2.5 w-1 rounded-r-full bg-cyan-400" />
                )}
                <Icon size={16} className={active ? 'text-cyan-300' : ''} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="space-y-3 p-4">
        <div className="flex items-center gap-2 rounded-full bg-white/[0.03] px-3 py-2 ring-1 ring-white/5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-xs text-zinc-500">Local Development</span>
        </div>
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-sm text-zinc-400 ring-1 ring-white/10 transition hover:bg-red-500/10 hover:text-red-300 hover:ring-red-500/20"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}