const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const BASE = 'http://localhost:3000/api/v1';
const TARGET = 'http://localhost:4000/webhook-flaky';

test('recovers from temporary HTTP 503 failures', { timeout: 30000 }, async () => {
  const apiKey = process.env.HOOKFLOW_API_KEY;
  assert.ok(apiKey, 'HOOKFLOW_API_KEY is required');

  const headers = {
    'x-api-key': apiKey,
    'Content-Type': 'application/json',
  };

  async function api(path, options = {}) {
    const response = await fetch(BASE + path, {
      ...options,
      headers,
    });
    const body = await response.json();
    assert.ok(response.ok, JSON.stringify(body));
    return body.data;
  }

  // Find the registered recovery-test webhook
  const webhooks = await api('/webhooks');
  const webhook = webhooks.find(w =>
    w.url === TARGET && w.status === 'ACTIVE'
  );
  assert.ok(webhook, 'Active flaky webhook not found');

  // Fire a real event
  const result = await api('/events', {
    method: 'POST',
    body: JSON.stringify({
      eventType: 'order.created',
      payload: { test: 'automated-recovery', id: randomUUID() },
    }),
  });

  assert.ok(
    result.deliveries.some(d => d.webhookId === webhook.id),
    'Delivery was not queued'
  );

  // Poll the persisted delivery status
  let delivery;
  const deadline = Date.now() + 25000;

  while (Date.now() < deadline) {
    const status = await api(`/events/${result.event.id}/status`);
    delivery = status.attempts.find(
      a => a.webhookId === webhook.id
    );

    if (delivery?.status === 'SUCCESS' ||
        delivery?.status === 'DLQ') break;

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  assert.equal(delivery?.status, 'SUCCESS');
  assert.equal(delivery.httpStatusCode, 200);

  console.log('Recovery integration test passed!');
});