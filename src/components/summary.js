import { statusClass, STATUS_ORDER } from '../lib/config.js';

/**
 * Render summary cards into #summary container.
 */
export function renderSummary(items) {
  const counts = {};
  STATUS_ORDER.forEach((s) => (counts[s] = 0));
  items.forEach((d) => {
    if (counts[d.status] !== undefined) counts[d.status]++;
  });

  const el = document.getElementById('summary');
  el.innerHTML =
    `<div class="summary-card">
      <div class="label">Total</div>
      <div class="value">${items.length}</div>
    </div>` +
    Object.entries(counts)
      .map(
        ([k, v]) =>
          `<div class="summary-card">
            <div class="label">${k}</div>
            <div class="value ${statusClass(k)}">${v}</div>
          </div>`
      )
      .join('');
}
