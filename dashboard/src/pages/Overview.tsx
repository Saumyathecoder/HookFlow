import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../lib/api';

interface OverviewData {
  totalWebhooks: number;
  activeWebhooks: number;
  suspendedWebhooks: number;
  totalEvents: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  dlqCount: number;
  successRate: string;
  avgResponseTimeMs: number;
  last24Hours: {
    events: number;
    deliveries: number;
    successRate: string;
  };
}

function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-b from-[#131316] to-[#0c0c0e] ring-1 ring-white/5 ${className}`}>
      {children}
    </div>
  );
}

function Kpi({
  label, value, sub, valueColor, accent,
}: { label: string; value: string | number; sub: string; valueColor: string; accent: string }) {
  return (
    <Card className="relative overflow-hidden p-5 pl-6">
      <span className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${accent}`} />
      <p className="text-[11px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{sub}</p>
    </Card>
  );
}

function Gauge({ pct, className }: { pct: number; className: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, pct));
  return (
    <svg viewBox="0 0 120 120" className={`h-44 w-44 -rotate-90 ${className}`}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#1f1f23" strokeWidth="9" />
      <circle
        cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="9"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)}
        className="transition-all duration-700"
      />
    </svg>
  );
}

export function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/analytics/overview');
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const sr = data ? parseFloat(data.successRate) : 0;
  const srColor = sr >= 80 ? 'text-green-400' : sr < 50 ? 'text-red-400' : 'text-yellow-400';
  const healthy = !!data && data.dlqCount === 0 && sr >= 80;

  const breakdown = data
    ? [
        { label: 'Successful', value: data.successfulDeliveries, text: 'text-green-400', bar: 'bg-green-400' },
        { label: 'Failed', value: data.failedDeliveries, text: 'text-red-400', bar: 'bg-red-400' },
        { label: 'Pending', value: data.pendingDeliveries, text: 'text-yellow-400', bar: 'bg-yellow-400' },
      ]
    : [];
  const barTotal = breakdown.reduce((a, b) => a + b.value, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/80">Dashboard</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Overview</h1>
          <p className="mt-1 text-sm text-zinc-500">System health and delivery analytics</p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                healthy
                  ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 ring-amber-500/20'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${healthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {healthy ? 'All systems healthy' : 'Needs attention'}
            </span>
          )}
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-5">
            <div className="h-64 animate-pulse rounded-2xl bg-white/5" />
            <div className="col-span-2 h-64 animate-pulse rounded-2xl bg-white/5" />
          </div>
          <div className="grid grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
      ) : data ? (
        <>
          {/* Hero: gauge + delivery breakdown */}
          <div className="grid grid-cols-3 gap-5">
            <Card className="flex flex-col items-center justify-center p-6">
              <p className="mb-3 self-start text-[11px] uppercase tracking-widest text-zinc-500">Success Rate</p>
              <div className="relative">
                <Gauge pct={sr} className={srColor} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-semibold tabular-nums ${srColor}`}>{data.successRate}</span>
                  <span className="text-[11px] text-zinc-500">overall</span>
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                {data.successfulDeliveries} of {data.totalDeliveries} deliveries
              </p>
            </Card>

            <Card className="col-span-2 p-6">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-widest text-zinc-500">Delivery Breakdown</p>
                <p className="text-xs text-zinc-500 tabular-nums">{barTotal} tracked</p>
              </div>

              <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-white/5">
                {breakdown.map((b) => (
                  <div
                    key={b.label}
                    className={`${b.bar} transition-all duration-700`}
                    style={{ width: `${barTotal ? (b.value / barTotal) * 100 : 0}%` }}
                  />
                ))}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {[...breakdown, { label: 'In DLQ', value: data.dlqCount, text: 'text-red-400', bar: 'bg-red-400' }].map((b) => (
                  <div key={b.label} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-zinc-400">
                      <span className={`h-2 w-2 rounded-full ${b.bar}`} />
                      {b.label}
                    </span>
                    <span className={`text-lg font-semibold tabular-nums ${b.text}`}>{b.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-5">
            <Kpi
              label="Total Webhooks"
              value={data.totalWebhooks}
              sub={`${data.activeWebhooks} active · ${data.suspendedWebhooks} suspended`}
              valueColor="text-cyan-300"
              accent="bg-cyan-400"
            />
            <Kpi
              label="Avg Response Time"
              value={`${data.avgResponseTimeMs}ms`}
              sub="across successful deliveries"
              valueColor="text-cyan-300"
              accent="bg-cyan-400"
            />
            <Kpi
              label="Dead Letter Queue"
              value={data.dlqCount}
              sub={data.dlqCount > 0 ? 'needs attention' : 'all clear'}
              valueColor={data.dlqCount > 0 ? 'text-red-400' : 'text-green-400'}
              accent={data.dlqCount > 0 ? 'bg-red-400' : 'bg-green-400'}
            />
          </div>

          {/* Last 24h */}
          <Card className="p-6">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">Last 24 Hours</p>
            <div className="mt-4 grid grid-cols-3 divide-x divide-white/5">
              {[
                { label: 'Events fired', value: data.last24Hours.events },
                { label: 'Deliveries attempted', value: data.last24Hours.deliveries },
                { label: 'Success rate', value: data.last24Hours.successRate },
              ].map(({ label, value }) => (
                <div key={label} className="px-6 first:pl-0 last:pr-0">
                  <p className="text-3xl font-semibold tabular-nums text-white">{value}</p>
                  <p className="mt-1 text-xs text-zinc-500">{label}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* All time */}
          <Card className="p-6">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500">All Time Stats</p>
            <div className="mt-4 grid grid-cols-4 divide-x divide-white/5">
              {[
                { label: 'Total Events', value: data.totalEvents },
                { label: 'Total Deliveries', value: data.totalDeliveries },
                { label: 'Active Webhooks', value: data.activeWebhooks },
                { label: 'Suspended', value: data.suspendedWebhooks },
              ].map(({ label, value }) => (
                <div key={label} className="px-6 first:pl-0 last:pr-0">
                  <p className="text-2xl font-semibold tabular-nums text-zinc-100">{value}</p>
                  <p className="mt-1 text-xs text-zinc-500">{label}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}