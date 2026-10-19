// Events.tsx
import { useState, type ReactNode } from 'react';
import { Zap } from 'lucide-react';
import { api } from '../lib/api';

const EVENT_TYPES = [
  'payment.success',
  'payment.failed',
  'order.created',
  'order.updated',
  'order.cancelled',
  'user.created',
  'user.deleted',
  'subscription.created',
  'subscription.cancelled',
];

const DEFAULT_PAYLOAD = JSON.stringify({ amount: 1000, currency: 'INR', orderId: 'ord_123' }, null, 2);

const inputCls =
  'w-full rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-600 ring-1 ring-white/10 transition focus:outline-none focus:ring-cyan-400/50';
const eyebrow = 'text-[11px] uppercase tracking-widest text-zinc-500';

function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-b from-[#131316] to-[#0c0c0e] ring-1 ring-white/5 ${className}`}>
      {children}
    </div>
  );
}

export function Events() {
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [idemKey, setIdemKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState('');

  async function fire() {
    setError('');
    let parsed;
    try { parsed = JSON.parse(payload); }
    catch { setError('Invalid JSON payload'); return; }

    setLoading(true);
    try {
      const body: any = { eventType, payload: parsed };
      if (idemKey.trim()) body.idempotencyKey = idemKey.trim();
      const res = await api.post('/events', body);
      setResponse(res);
    } catch {
      setError('Request failed. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  const deliveries = response?.data?.deliveries || [];
  const isDuplicate = response?.data?.duplicate;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400/80">Playground</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Fire Event</h1>
        <p className="mt-1 text-sm text-zinc-500">Send a test event to trigger webhook deliveries</p>
      </div>

      <div className="grid grid-cols-5 items-start gap-5">
        {/* Form */}
        <Card className="col-span-2 p-6">
          <p className={eyebrow}>Event Details</p>

          <div className="mt-5 space-y-6">
            <div>
              <label className={`${eyebrow} mb-2.5 block`}>Event Type</label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map(t => (
                  <button
                    key={t}
                    onClick={() => setEventType(t)}
                    className={`rounded-full px-3 py-1.5 font-mono text-xs ring-1 transition ${
                      eventType === t
                        ? 'bg-cyan-400/15 text-cyan-300 ring-cyan-400/40'
                        : 'bg-white/[0.03] text-zinc-500 ring-white/10 hover:text-zinc-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={`${eyebrow} mb-2 block`}>
                Idempotency Key <span className="normal-case tracking-normal text-zinc-600">(optional)</span>
              </label>
              <input
                type="text"
                value={idemKey}
                onChange={e => setIdemKey(e.target.value)}
                placeholder="Leave empty to skip"
                className={inputCls}
              />
            </div>

            <div>
              <label className={`${eyebrow} mb-2 block`}>Payload (JSON)</label>
              <textarea
                value={payload}
                onChange={e => setPayload(e.target.value)}
                rows={8}
                className={`${inputCls} resize-none font-mono`}
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 px-4 py-3 ring-1 ring-red-500/20">
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}

            <button
              onClick={fire}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-50"
            >
              <Zap size={15} />
              {loading ? 'Firing...' : 'Fire Event'}
            </button>
          </div>
        </Card>

        {/* Response */}
        <div className="col-span-3">
          {response ? (
            <Card className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <p className={eyebrow}>Response</p>
                {isDuplicate ? (
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/20">
                    Duplicate
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/20">
                    Success
                  </span>
                )}
              </div>

              <div className="rounded-xl bg-white/[0.04] p-4 ring-1 ring-white/5">
                <p className="text-[11px] uppercase tracking-widest text-zinc-600">Event ID</p>
                <p className="mt-1.5 break-all font-mono text-xs text-cyan-300">{response.data?.event?.id}</p>
              </div>

              <div>
                <p className={`${eyebrow} mb-3`}>Deliveries Queued ({deliveries.length})</p>
                {deliveries.length === 0 ? (
                  <p className="text-xs text-zinc-600">No matching webhooks found for this event type</p>
                ) : (
                  <div className="space-y-2">
                    {deliveries.map((d: any) => (
                      <div
                        key={d.deliveryAttemptId}
                        className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/5"
                      >
                        <span className="truncate font-mono text-xs text-zinc-300">{d.webhookId}</span>
                        <span className="shrink-0 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 ring-1 ring-amber-500/20">
                          {d.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className={`${eyebrow} mb-3`}>Raw Response</p>
                <pre className="max-h-56 overflow-auto rounded-xl bg-black/40 p-4 font-mono text-xs text-emerald-300 ring-1 ring-white/5">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            </Card>
          ) : (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-white/10">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400/10 ring-1 ring-cyan-400/20">
                  <Zap size={22} className="text-cyan-300" />
                </div>
                <p className="text-sm text-zinc-500">Fire an event to see the response</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}