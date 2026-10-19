import { useEffect, useState, type ReactNode } from 'react';
import { RefreshCw, X, CheckCircle, XCircle, Clock, Plus, Trash2, Edit2, BarChart2 } from 'lucide-react';
import { api } from '../lib/api';

interface Webhook {
  id: string;
  url: string;
  eventTypes: string[];
  status: string;
  failureCount: number;
  createdAt: string;
}

interface HistoryData {
  webhook: { id: string; url: string; status: string; failureCount: number };
  stats: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    dlq: number;
    successRate: string;
    avgResponseTimeMs: number;
  };
  attempts: Array<{
    id: string;
    status: string;
    httpStatusCode: number | null;
    responseTimeMs: number | null;
    attemptNumber: number;
    errorMessage: string | null;
    createdAt: string;
    event: { eventType: string };
  }>;
}

interface AnalyticsData {
  webhook: { id: string; url: string; status: string; eventTypes: string[]; failureCount: number; createdAt: string };
  stats: {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    dlqCount: number;
    successRate: string;
    responseTime: { avg: number; min: number; max: number };
  };
  recentAttempts: Array<{
    id: string;
    status: string;
    httpStatusCode: number | null;
    responseTimeMs: number | null;
    attemptNumber: number;
    createdAt: string;
    event: { eventType: string; createdAt: string };
  }>;
}

const EVENT_TYPES = [
  'payment.success', 'payment.failed', 'order.created',
  'order.updated', 'order.cancelled', 'user.created',
  'user.deleted', 'subscription.created', 'subscription.cancelled', '*',
];

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

type DrawerMode = 'history' | 'analytics' | 'add' | 'edit';

/* ---------- UI helpers ---------- */

const inputCls =
  'w-full rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-600 ring-1 ring-white/10 transition focus:outline-none focus:ring-cyan-400/50';
const iconBtn =
  'rounded-lg bg-white/5 p-2 text-zinc-400 ring-1 ring-white/10 transition hover:bg-white/10';
const eyebrow = 'text-[11px] uppercase tracking-widest text-zinc-500';

function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-b from-[#131316] to-[#0c0c0e] ring-1 ring-white/5 ${className}`}>
      {children}
    </div>
  );
}

function Tile({ label, value, color = 'text-white', size = 'text-2xl' }: { label: string; value: string | number; color?: string; size?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/5">
      <p className={`${size} font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <span className="rounded-md bg-cyan-400/10 px-2 py-0.5 font-mono text-[11px] text-cyan-300 ring-1 ring-cyan-400/15">
      {label}
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
  SUSPENDED: 'bg-red-500/10 text-red-300 ring-red-500/20',
  INACTIVE: 'bg-zinc-500/10 text-zinc-400 ring-zinc-500/20',
};
const STATUS_ACCENT: Record<string, string> = {
  ACTIVE: 'bg-emerald-400',
  SUSPENDED: 'bg-red-400',
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${STATUS_STYLE[status] ?? STATUS_STYLE.INACTIVE}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

/* ---------- Page ---------- */

export function Webhooks() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('history');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Add/Edit form state
  const [formUrl, setFormUrl] = useState('');
  const [formEventTypes, setFormEventTypes] = useState<string[]>(['payment.success']);
  const [formStatus, setFormStatus] = useState('ACTIVE');
  const [editingId, setEditingId] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/webhooks');
      setWebhooks(res.data || []);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(''), 3000);
  }

  function openDrawer(mode: DrawerMode) {
    setDrawerMode(mode);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setFormError('');
  }

  async function viewHistory(id: string) {
    openDrawer('history');
    setDrawerLoading(true);
    setHistory(null);
    try {
      const res = await api.get(`/webhooks/${id}/history`);
      setHistory(res.data);
    } finally {
      setDrawerLoading(false);
    }
  }

  async function viewAnalytics(id: string) {
    openDrawer('analytics');
    setDrawerLoading(true);
    setAnalytics(null);
    try {
      const res = await api.get(`/analytics/webhook/${id}`);
      setAnalytics(res.data);
    } finally {
      setDrawerLoading(false);
    }
  }

  function openAdd() {
    setFormUrl('');
    setFormEventTypes(['payment.success']);
    setFormError('');
    openDrawer('add');
  }

  function openEdit(w: Webhook) {
    setEditingId(w.id);
    setFormUrl(w.url);
    setFormEventTypes(w.eventTypes);
    setFormStatus(w.status);
    setFormError('');
    openDrawer('edit');
  }

  async function handleAdd() {
    if (!formUrl.trim()) { setFormError('URL is required'); return; }
    if (formEventTypes.length === 0) { setFormError('Select at least one event type'); return; }
    setFormLoading(true);
    setFormError('');
    try {
      const res = await api.post('/webhooks', { url: formUrl, eventTypes: formEventTypes });
      if (res.success) {
        showToast('Webhook registered successfully');
        closeDrawer();
        load();
      } else {
        setFormError(res.message || res.errors?.[0]?.message || 'Failed to create webhook');
      }
    } catch {
      setFormError('Request failed');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleEdit() {
    setFormLoading(true);
    setFormError('');
    try {
      const res = await api.put(`/webhooks/${editingId}`, {
        url: formUrl,
        eventTypes: formEventTypes,
        status: formStatus,
      });
      if (res.success) {
        showToast('Webhook updated successfully');
        closeDrawer();
        load();
      } else {
        setFormError(res.message || 'Failed to update webhook');
      }
    } catch {
      setFormError('Request failed');
    } finally {
      setFormLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this webhook? This cannot be undone.')) return;
    try {
      const res = await api.delete(`/webhooks/${id}`);
      if (res.success) {
        showToast('Webhook deleted');
        load();
      } else {
        showToast('Failed to delete', 'error');
      }
    } catch {
      showToast('Failed to delete', 'error');
    }
  }

  async function reactivate(id: string) {
    try {
      const res = await api.post(`/webhooks/${id}/reactivate`);
      if (res.success) {
        showToast('Webhook reactivated');
        load();
      } else {
        showToast('Failed to reactivate', 'error');
      }
    } catch {
      showToast('Failed to reactivate', 'error');
    }
  }

  function toggleEventType(et: string) {
    setFormEventTypes(prev =>
      prev.includes(et) ? prev.filter(e => e !== et) : [...prev, et]
    );
  }

  useEffect(() => { load(); }, []);

  const picker = (
    <div className="flex flex-wrap gap-2">
      {EVENT_TYPES.map(et => (
        <button
          key={et}
          onClick={() => toggleEventType(et)}
          className={`rounded-full px-3 py-1.5 font-mono text-xs ring-1 transition ${
            formEventTypes.includes(et)
              ? 'bg-cyan-400/15 text-cyan-300 ring-cyan-400/40'
              : 'bg-white/[0.03] text-zinc-500 ring-white/10 hover:text-zinc-300'
          }`}
        >
          {et}
        </button>
      ))}
    </div>
  );

  const errorBox = formError && (
    <div className="rounded-xl bg-red-500/10 px-4 py-3 ring-1 ring-red-500/20">
      <p className="text-xs text-red-300">{formError}</p>
    </div>
  );

  const primaryBtn =
    'w-full rounded-xl bg-cyan-400 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-50';

  const drawerTitle =
    drawerMode === 'history' ? 'Delivery History'
    : drawerMode === 'analytics' ? 'Webhook Analytics'
    : drawerMode === 'add' ? 'Register Webhook'
    : 'Edit Webhook';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/80">Endpoints</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Webhooks</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage registered webhook endpoints
            {!loading && webhooks.length > 0 && <span className="text-zinc-600"> · {webhooks.length} total</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300"
          >
            <Plus size={15} />
            Add Webhook
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-14 text-center">
          <p className="mb-4 text-sm text-zinc-500">No webhooks registered yet</p>
          <button
            onClick={openAdd}
            className="rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300"
          >
            Register your first webhook
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(w => (
            <Card key={w.id} className="relative overflow-hidden p-5 pl-6 transition hover:ring-white/10">
              <span className={`absolute bottom-4 left-0 top-4 w-1 rounded-r-full ${STATUS_ACCENT[w.status] ?? 'bg-zinc-600'}`} />
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <p className="truncate font-mono text-sm text-zinc-100" title={w.url}>{w.url}</p>
                    <StatusPill status={w.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {w.eventTypes.map(e => <Chip key={e} label={e} />)}
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    Created {timeAgo(w.createdAt)}
                    <span className="mx-2 text-zinc-700">•</span>
                    <span className={w.failureCount > 0 ? 'text-red-400' : ''}>
                      {w.failureCount} {w.failureCount === 1 ? 'failure' : 'failures'}
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => viewHistory(w.id)}
                    className="rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
                    title="Delivery History"
                  >
                    History
                  </button>
                  <button onClick={() => viewAnalytics(w.id)} className={`${iconBtn} hover:text-cyan-300`} title="Analytics">
                    <BarChart2 size={14} />
                  </button>
                  <button onClick={() => openEdit(w)} className={`${iconBtn} hover:text-white`} title="Edit">
                    <Edit2 size={14} />
                  </button>
                  {w.status === 'SUSPENDED' && (
                    <button
                      onClick={() => reactivate(w.id)}
                      className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 ring-1 ring-emerald-500/20 transition hover:bg-emerald-500/20"
                    >
                      Reactivate
                    </button>
                  )}
                  <button onClick={() => handleDelete(w.id)} className={`${iconBtn} hover:text-red-400`} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={closeDrawer} />
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-3 right-3 top-3 z-50 w-[500px] overflow-y-auto rounded-3xl bg-[#0d0d10] ring-1 ring-white/10 transition-transform duration-300 ${
          drawerOpen ? 'translate-x-0' : 'translate-x-[110%]'
        }`}
      >
        <div className="p-7">
          <div className="mb-7 flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/80">
                {drawerMode === 'add' || drawerMode === 'edit' ? 'Configure' : 'Insights'}
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{drawerTitle}</h2>
            </div>
            <button onClick={closeDrawer} className="rounded-full bg-white/5 p-2 ring-1 ring-white/10 transition hover:bg-white/10">
              <X size={16} className="text-zinc-400" />
            </button>
          </div>

          {/* ADD FORM */}
          {drawerMode === 'add' && (
            <div className="space-y-6">
              <div>
                <label className={`${eyebrow} mb-2 block`}>Webhook URL</label>
                <input
                  type="text"
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`${eyebrow} mb-2.5 block`}>
                  Event Types <span className="normal-case tracking-normal text-zinc-600">(select all that apply)</span>
                </label>
                {picker}
              </div>
              {errorBox}
              <button onClick={handleAdd} disabled={formLoading} className={primaryBtn}>
                {formLoading ? 'Registering...' : 'Register Webhook'}
              </button>
            </div>
          )}

          {/* EDIT FORM */}
          {drawerMode === 'edit' && (
            <div className="space-y-6">
              <div>
                <label className={`${eyebrow} mb-2 block`}>Webhook URL</label>
                <input
                  type="text"
                  value={formUrl}
                  onChange={e => setFormUrl(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`${eyebrow} mb-2.5 block`}>Event Types</label>
                {picker}
              </div>
              <div>
                <label className={`${eyebrow} mb-2 block`}>Status</label>
                <select
                  value={formStatus}
                  onChange={e => setFormStatus(e.target.value)}
                  className={inputCls}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              {errorBox}
              <button onClick={handleEdit} disabled={formLoading} className={primaryBtn}>
                {formLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* HISTORY */}
          {drawerMode === 'history' && (
            drawerLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />)}
              </div>
            ) : history ? (
              <>
                <div className="mb-5 truncate rounded-xl bg-white/[0.04] px-3 py-2 font-mono text-xs text-zinc-400 ring-1 ring-white/5">
                  {history.webhook.url}
                </div>
                <div className="mb-3 grid grid-cols-3 gap-3">
                  <Tile label="Total" value={history.stats.total} />
                  <Tile label="Success Rate" value={history.stats.successRate} color="text-green-400" />
                  <Tile label="Avg Latency" value={`${history.stats.avgResponseTimeMs}ms`} color="text-cyan-300" />
                </div>
                <div className="mb-7 grid grid-cols-3 gap-3">
                  <Tile label="Successful" value={history.stats.successful} color="text-green-400" size="text-lg" />
                  <Tile label="Failed" value={history.stats.failed} color="text-red-400" size="text-lg" />
                  <Tile label="In DLQ" value={history.stats.dlq} color="text-red-400" size="text-lg" />
                </div>
                <p className={`${eyebrow} mb-3`}>Recent Attempts</p>
                <div className="space-y-2">
                  {history.attempts.map(a => (
                    <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                      {a.status === 'SUCCESS'
                        ? <CheckCircle size={16} className="flex-shrink-0 text-green-400" />
                        : a.status === 'PENDING'
                        ? <Clock size={16} className="flex-shrink-0 text-yellow-400" />
                        : <XCircle size={16} className="flex-shrink-0 text-red-400" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white">{a.event?.eventType}</span>
                          <span className="text-xs text-zinc-600">#{a.attemptNumber}</span>
                          {a.httpStatusCode && <span className="font-mono text-xs text-zinc-500">{a.httpStatusCode}</span>}
                        </div>
                        {a.errorMessage && <p className="mt-0.5 truncate text-xs text-red-400">{a.errorMessage}</p>}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {a.responseTimeMs && <p className="text-xs text-zinc-300">{a.responseTimeMs}ms</p>}
                        <p className="text-xs text-zinc-600">{timeAgo(a.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null
          )}

          {/* ANALYTICS */}
          {drawerMode === 'analytics' && (
            drawerLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />)}
              </div>
            ) : analytics ? (
              <>
                <div className="mb-5 truncate rounded-xl bg-white/[0.04] px-3 py-2 font-mono text-xs text-zinc-400 ring-1 ring-white/5">
                  {analytics.webhook.url}
                </div>
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <Tile label="Success Rate" value={analytics.stats.successRate} color="text-green-400" />
                  <Tile label="Avg Response" value={`${analytics.stats.responseTime.avg}ms`} color="text-cyan-300" />
                  <Tile label="Total Deliveries" value={analytics.stats.totalDeliveries} />
                  <Tile label="In DLQ" value={analytics.stats.dlqCount} color="text-red-400" />
                </div>
                <div className="mb-7 rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/5">
                  <p className={`${eyebrow} mb-3`}>Response Time</p>
                  <div className="grid grid-cols-3 divide-x divide-white/5 text-center">
                    <div>
                      <p className="text-sm font-medium text-white">{analytics.stats.responseTime.min}ms</p>
                      <p className="text-xs text-zinc-600">Min</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-cyan-300">{analytics.stats.responseTime.avg}ms</p>
                      <p className="text-xs text-zinc-600">Avg</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{analytics.stats.responseTime.max}ms</p>
                      <p className="text-xs text-zinc-600">Max</p>
                    </div>
                  </div>
                </div>
                <p className={`${eyebrow} mb-3`}>Recent Attempts</p>
                <div className="space-y-2">
                  {analytics.recentAttempts.map(a => (
                    <div key={a.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/5">
                      {a.status === 'SUCCESS'
                        ? <CheckCircle size={14} className="flex-shrink-0 text-green-400" />
                        : <XCircle size={14} className="flex-shrink-0 text-red-400" />}
                      <div className="flex-1">
                        <span className="text-xs text-white">{a.event?.eventType}</span>
                        <span className="ml-2 text-xs text-zinc-600">#{a.attemptNumber}</span>
                      </div>
                      <div className="text-right">
                        {a.responseTimeMs && <p className="text-xs text-zinc-300">{a.responseTimeMs}ms</p>}
                        <p className="text-xs text-zinc-600">{timeAgo(a.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-[#111114] px-5 py-3 text-sm text-white ring-1 ${
            toastType === 'success' ? 'ring-green-500/30' : 'ring-red-500/30'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${toastType === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
          {toast}
        </div>
      )}
    </div>
  );
}