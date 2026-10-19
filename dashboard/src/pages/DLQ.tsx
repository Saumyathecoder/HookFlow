// DLQ.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw, RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

interface DLQItem {
  id: string;
  lastError: string | null;
  totalAttempts: number;
  movedAt: string;
  event: { id: string; eventType: string; createdAt: string };
  webhook: { id: string; url: string; status: string };
}

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-b from-[#131316] to-[#0c0c0e] ring-1 ring-white/5 ${className}`}>
      {children}
    </div>
  );
}

export function DLQ() {
  const [items, setItems] = useState<DLQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/dlq');
      setItems(res.data || []);
    } finally {
      setLoading(false);
    }
  }

  async function retry(id: string) {
    setRetrying(id);
    try {
      await api.post(`/dlq/${id}/retry`);
      setToast('Retry queued successfully');
      setTimeout(() => setToast(''), 3000);
      load();
    } catch {
      setToast('Retry failed');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setRetrying(null);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/80">Failures</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Dead Letter Queue</h1>
          <p className="mt-1 text-sm text-zinc-500">Events that failed all delivery attempts</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Alert */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-red-500/10 px-5 py-4 ring-1 ring-red-500/20">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-500/15">
            <AlertTriangle size={15} className="text-red-400" />
          </span>
          <p className="text-sm text-red-300">
            {items.length} event{items.length > 1 ? 's' : ''} failed all delivery attempts and need attention
          </p>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <span className="text-lg text-emerald-400">✓</span>
          </div>
          <p className="text-sm text-zinc-400">Dead Letter Queue is empty</p>
          <p className="mt-1 text-xs text-zinc-600">All events delivered successfully</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Card key={item.id} className="relative overflow-hidden p-5 pl-6 transition hover:ring-white/10">
              <span className="absolute bottom-4 left-0 top-4 w-1 rounded-r-full bg-red-400" />
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-md bg-cyan-400/10 px-2 py-0.5 font-mono text-[11px] text-cyan-300 ring-1 ring-cyan-400/15">
                      {item.event.eventType}
                    </span>
                    <span className="text-xs text-zinc-500">failed {timeAgo(item.movedAt)}</span>
                    <span className="text-xs text-zinc-700">•</span>
                    <span className="text-xs text-amber-300">
                      {item.totalAttempts} {item.totalAttempts === 1 ? 'attempt' : 'attempts'}
                    </span>
                  </div>

                  <p className="mt-3 truncate font-mono text-sm text-zinc-100" title={item.webhook.url}>
                    {item.webhook.url}
                  </p>

                  <div className="mt-3 rounded-xl bg-red-500/[0.07] px-3.5 py-2.5 ring-1 ring-red-500/10">
                    <p className="text-[10px] uppercase tracking-widest text-red-400/60">Last error</p>
                    <p className="mt-1 truncate text-xs text-red-300" title={item.lastError || ''}>
                      {item.lastError || '-'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => retry(item.id)}
                  disabled={retrying === item.id}
                  className="flex shrink-0 items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/20 transition hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <RotateCcw size={12} className={retrying === item.id ? 'animate-spin' : ''} />
                  Retry
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-[#111114] px-5 py-3 text-sm text-white ring-1 ring-white/10">
          <span className="h-2 w-2 rounded-full bg-green-400" />
          {toast}
        </div>
      )}
    </div>
  );
}