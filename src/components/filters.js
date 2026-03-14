import { getData } from '../lib/store.js';
import { setTimelineRange, resetTimelineRange as resetRange, getTimelineStart, getTimelineEnd } from '../lib/timeline.js';

let _onFilter = null;

// ── Multi-select state ──────────────────────────────────────────────
const _selected = {
  filterModule: new Set(),
  filterStatus: new Set(),
  filterVersion: new Set(),
};

/**
 * Populate filter dropdowns from current data.
 */
export function populateFilters() {
  const data = getData();
  const modules = [...new Set(data.map((d) => d.module))].sort();
  const statuses = [...new Set(data.map((d) => d.status))];
  const versions = [...new Set(data.filter((d) => d.version).map((d) => d.version))].sort();

  buildMultiSelect('filterModule', modules);
  buildMultiSelect('filterStatus', statuses);
  buildMultiSelect('filterVersion', versions);
}

function buildMultiSelect(id, options) {
  const container = document.getElementById(id);
  const dropdown = container.querySelector('.multi-select-dropdown');
  const placeholder = container.dataset.placeholder;

  // Prune any selections that no longer exist
  const valid = new Set(options);
  _selected[id].forEach((v) => { if (!valid.has(v)) _selected[id].delete(v); });

  let html = `<div class="ms-actions">
    <button data-action="all">Select All</button>
    <button data-action="none">Clear</button>
  </div>`;

  options.forEach((o) => {
    const checked = _selected[id].has(o) ? ' checked' : '';
    html += `<label class="ms-option">
      <input type="checkbox" value="${escapeAttr(o)}"${checked} /> ${escapeHtml(o)}
    </label>`;
  });

  dropdown.innerHTML = html;
  updateToggleLabel(id, placeholder);

  // Checkbox change handlers
  dropdown.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) _selected[id].add(cb.value);
      else _selected[id].delete(cb.value);
      updateToggleLabel(id, placeholder);
      if (_onFilter) _onFilter();
    });
  });

  // Select All / Clear
  dropdown.querySelectorAll('.ms-actions button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'all') {
        options.forEach((o) => _selected[id].add(o));
        dropdown.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = true));
      } else {
        _selected[id].clear();
        dropdown.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
      }
      updateToggleLabel(id, placeholder);
      if (_onFilter) _onFilter();
    });
  });
}

function updateToggleLabel(id, placeholder) {
  const container = document.getElementById(id);
  const toggle = container.querySelector('.multi-select-toggle');
  const count = _selected[id].size;
  if (count === 0) {
    toggle.innerHTML = `${placeholder} <span class="ms-arrow">&#9662;</span>`;
  } else {
    toggle.innerHTML = `${placeholder} <span class="ms-badge">${count}</span> <span class="ms-arrow">&#9662;</span>`;
  }
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/**
 * Count active filter selections (for the badge on the filter button).
 */
export function getActiveFilterCount() {
  return _selected.filterModule.size + _selected.filterStatus.size + _selected.filterVersion.size;
}

/**
 * Get filtered data based on current multi-select values and timeline range.
 */
export function getFiltered() {
  const data = getData();
  const fm = _selected.filterModule;
  const fs = _selected.filterStatus;
  const fv = _selected.filterVersion;

  // Timeline date range for filtering rows
  const rangeStart = getTimelineStart();
  const rangeEnd = getTimelineEnd();

  return data.filter((d) => {
    // Multi-select filters
    if (fm.size > 0 && !fm.has(d.module)) return false;
    if (fs.size > 0 && !fs.has(d.status)) return false;
    if (fv.size > 0 && !fv.has(d.version)) return false;

    // Date range filter: item must overlap with the timeline range
    // Items without dates are always shown
    if (d.start && d.end) {
      const itemStart = new Date(d.start);
      const itemEnd = new Date(d.end);
      // No overlap if item ends before range starts or item starts after range ends
      if (itemEnd < rangeStart || itemStart > rangeEnd) return false;
    }

    return true;
  });
}

/**
 * Apply timeline month range from filter inputs.
 */
export function applyTimelineRange() {
  const fromVal = document.getElementById('filterMonthFrom').value;
  const toVal = document.getElementById('filterMonthTo').value;

  const start = fromVal ? new Date(...fromVal.split('-').map((n, i) => (i === 1 ? n - 1 : +n))) : null;
  const end = toVal ? (() => { const [y, m] = toVal.split('-').map(Number); return new Date(y, m, 1); })() : null;

  setTimelineRange(start, end);
  if (_onFilter) _onFilter();
}

export function resetTimelineRange() {
  document.getElementById('filterMonthFrom').value = '';
  document.getElementById('filterMonthTo').value = '';
  resetRange();
  if (_onFilter) _onFilter();
}

/**
 * Initialize all filter event listeners.
 */
export function initFilters(onFilter) {
  _onFilter = onFilter;

  // Set default range: 8 months before today to 6 months after today
  const now = new Date();
  const fromDate = new Date(now.getFullYear(), now.getMonth() - 8, 1);
  const toDate = new Date(now.getFullYear(), now.getMonth() + 6, 1);
  const pad = (n) => String(n).padStart(2, '0');
  document.getElementById('filterMonthFrom').value = `${fromDate.getFullYear()}-${pad(fromDate.getMonth() + 1)}`;
  document.getElementById('filterMonthTo').value = `${toDate.getFullYear()}-${pad(toDate.getMonth() + 1)}`;

  // Multi-select toggle open/close
  document.querySelectorAll('.multi-select').forEach((ms) => {
    const toggle = ms.querySelector('.multi-select-toggle');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = ms.classList.contains('open');
      // Close all others
      document.querySelectorAll('.multi-select.open').forEach((o) => o.classList.remove('open'));
      if (!wasOpen) ms.classList.add('open');
    });
  });

  // Close on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.multi-select.open').forEach((o) => o.classList.remove('open'));
  });

  // Stop propagation inside dropdown
  document.querySelectorAll('.multi-select-dropdown').forEach((dd) => {
    dd.addEventListener('click', (e) => e.stopPropagation());
  });

  document.getElementById('filterMonthFrom').addEventListener('change', applyTimelineRange);
  document.getElementById('filterMonthTo').addEventListener('change', applyTimelineRange);
  document.getElementById('btnResetRange').addEventListener('click', resetTimelineRange);
}
