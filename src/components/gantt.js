import { statusClass, STATUS_ORDER } from '../lib/config.js';
import { getMonths, dayOffset, pct, totalDays, formatDate, getTimelineStart } from '../lib/timeline.js';

// ── Sort state ──────────────────────────────────────────────────────
let _sortCol = null;
let _sortAsc = true;

// ── Column definitions ──────────────────────────────────────────────
const COLUMNS = [
  { key: 'module',  label: 'Module',       visible: true, width: 100 },
  { key: 'detail',  label: 'Detail',       visible: true, width: 260 },
  { key: 'status',  label: 'Status',       visible: true, width: 110 },
  { key: 'version', label: 'Version',      visible: true, width: 150 },
  { key: 'end',     label: 'Expected End', visible: true, width: 120 },
];

export function getColumns() { return COLUMNS; }

// ── Grouping ────────────────────────────────────────────────────────
let _groupBy = 'none';
const _collapsed = new Set();

export function setGroupBy(val) {
  _groupBy = val;
  _collapsed.clear();
}

/**
 * Initialize column toggle dropdown.
 */
export function initColumnToggle(onRender) {
  const container = document.getElementById('columnToggle');
  const dropdown = container.querySelector('.multi-select-dropdown');

  // On mobile, default to showing only "detail" column
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    COLUMNS.forEach((col) => {
      col.visible = col.key === 'detail';
    });
  }

  let html = '';
  COLUMNS.forEach((col) => {
    const checked = col.visible ? ' checked' : '';
    html += `<label class="ms-option">
      <input type="checkbox" value="${col.key}"${checked} /> ${col.label}
    </label>`;
  });
  dropdown.innerHTML = html;

  dropdown.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const col = COLUMNS.find((c) => c.key === cb.value);
      if (col) col.visible = cb.checked;
      if (onRender) onRender();
    });
  });
}

// ── Helper: compute layout from visible columns ─────────────────────
function computeLayout() {
  const visibleCols = COLUMNS.filter((c) => c.visible);
  let leftAccum = 0;
  const colLeft = {};
  const colWidth = {};
  visibleCols.forEach((col) => {
    colLeft[col.key] = leftAccum;
    colWidth[col.key] = col.width;
    leftAccum += col.width;
  });
  const lastVisibleKey = visibleCols.length > 0 ? visibleCols[visibleCols.length - 1].key : null;
  return { visibleCols, colLeft, colWidth, lastVisibleKey, totalStickyWidth: leftAccum };
}

/**
 * Render the Gantt chart table.
 */
export function renderGantt(items) {
  const table = document.getElementById('ganttTable');
  const months = getMonths();
  const now = new Date();
  const currentMonth = now.getFullYear() * 12 + now.getMonth();

  const sorted = sortItems([...items]);
  const layout = computeLayout();
  const { visibleCols, colLeft, colWidth, lastVisibleKey } = layout;

  // Build header
  let html = `<thead><tr>`;
  visibleCols.forEach((col) => {
    const isLast = col.key === lastVisibleKey;
    const w = colWidth[col.key];
    const sortIcon = getSortIcon(col.key);
    html += `<th class="sticky-col sortable" data-sort="${col.key}"
      style="left:${colLeft[col.key]}px;min-width:${w}px;max-width:${w}px;${isLast ? 'border-right:2px solid var(--border);' : ''}"
      rowspan="2">${col.label} ${sortIcon}<span class="col-resize-handle" data-col="${col.key}"></span></th>`;
  });

  months.forEach((m) => {
    const key = m.getFullYear() * 12 + m.getMonth();
    let cls = key === currentMonth ? ' month-header-current month-header-today' : '';
    html += `<th class="month-col${cls}" style="text-align:center;font-size:10px;padding:6px 0;vertical-align:bottom">
      ${m.toLocaleDateString('en-US', { month: 'short' })}<br>${m.getFullYear()}
    </th>`;
  });
  html += `</tr></thead><tbody>`;

  if (sorted.length === 0) {
    const totalCols = visibleCols.length + months.length;
    html += `<tr><td colspan="${totalCols}" class="no-data">No items match filters</td></tr>`;
  } else if (_groupBy !== 'none') {
    html += buildGroupedRows(sorted, months, layout);
  } else {
    sorted.forEach((d) => {
      html += buildRow(d, months, layout);
    });
  }

  html += `</tbody>`;
  table.innerHTML = html;
  addTodayLine();
  bindTooltips();
  bindCommentIcons();
  bindSortHeaders();
  bindGroupToggle();
  bindColumnResize();
  scrollToToday();
}

function getSortIcon(colKey) {
  if (_sortCol !== colKey) return `<span class="sort-icon">&#8597;</span>`;
  return _sortAsc
    ? `<span class="sort-icon active">&#9650;</span>`
    : `<span class="sort-icon active">&#9660;</span>`;
}

function sortItems(items) {
  if (!_sortCol) return items;

  const statusOrder = {};
  STATUS_ORDER.forEach((s, i) => (statusOrder[s] = i));

  return items.sort((a, b) => {
    let va, vb;
    switch (_sortCol) {
      case 'module':  va = a.module || ''; vb = b.module || ''; break;
      case 'detail':  va = a.detail || ''; vb = b.detail || ''; break;
      case 'status':  va = statusOrder[a.status] ?? 99; vb = statusOrder[b.status] ?? 99;
        return _sortAsc ? va - vb : vb - va;
      case 'version': va = a.version || ''; vb = b.version || ''; break;
      case 'end':     va = a.end || ''; vb = b.end || ''; break;
      default: return 0;
    }
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
    return _sortAsc ? cmp : -cmp;
  });
}

function buildGroupedRows(items, months, layout) {
  const { visibleCols, colLeft, colWidth, lastVisibleKey } = layout;
  const groups = new Map();
  items.forEach((d) => {
    const key = d[_groupBy] || '\u2014';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(d);
  });

  let html = '';

  groups.forEach((groupItems, groupName) => {
    const isCollapsed = _collapsed.has(groupName);
    const toggleCls = isCollapsed ? ' collapsed' : '';

    // Group row: sticky cell spanning all sticky columns + empty timeline cells
    html += `<tr class="group-row" data-group="${escapeAttr(groupName)}">`;

    // First sticky col gets the group label
    if (visibleCols.length > 0) {
      const firstCol = visibleCols[0];
      const lastCol = visibleCols[visibleCols.length - 1];
      const totalStickyW = colLeft[lastCol.key] + colWidth[lastCol.key];
      html += `<td class="sticky-col group-label-cell" colspan="${visibleCols.length}"
        style="left:0;min-width:${totalStickyW}px;${lastVisibleKey ? 'border-right:2px solid var(--border);' : ''}">
        <span class="group-toggle${toggleCls}">&#9660;</span>
        ${escapeHtml(groupName)}
        <span class="group-count">(${groupItems.length})</span>
      </td>`;
    }
    html += `<td colspan="${months.length}" class="group-timeline-cell"></td>`;
    html += `</tr>`;

    groupItems.forEach((d) => {
      const hiddenCls = isCollapsed ? ' group-hidden' : '';
      html += buildRow(d, months, layout, hiddenCls, groupName);
    });
  });

  return html;
}

function buildRow(d, months, layout, extraClass = '', groupName = '') {
  const { visibleCols, colLeft, colWidth, lastVisibleKey } = layout;
  const sc = statusClass(d.status);
  const barHtml = buildBar(d, sc);
  const safeJson = JSON.stringify(d).replace(/'/g, '&#39;');
  const groupAttr = groupName ? ` data-group-member="${escapeAttr(groupName)}"` : '';

  let html = `<tr class="${extraClass.trim()}"${groupAttr}>`;

  visibleCols.forEach((col) => {
    const isLast = col.key === lastVisibleKey;
    const w = colWidth[col.key];
    const style = `left:${colLeft[col.key]}px;min-width:${w}px;max-width:${w}px;${isLast ? 'border-right:2px solid var(--border);' : ''}`;

    switch (col.key) {
      case 'module':
        html += `<td class="sticky-col col-module" style="${style}">${d.module}</td>`;
        break;
      case 'detail':
        html += `<td class="sticky-col col-detail" style="${style}" title="${escapeAttr(d.detail)}">${d.detail}</td>`;
        break;
      case 'status':
        html += `<td class="sticky-col col-status" style="${style}"><span class="badge badge-${sc}">${d.status}</span></td>`;
        break;
      case 'version':
        html += `<td class="sticky-col col-version" style="${style}">${d.version || '\u2014'}</td>`;
        break;
      case 'end':
        html += `<td class="sticky-col col-end" style="${style}">${formatEndDate(d.end)}</td>`;
        break;
    }
  });

  html += `<td colspan="${months.length}"><div class="timeline-cell" data-item='${safeJson}'>${barHtml}</div></td>`;
  html += `</tr>`;
  return html;
}

function formatEndDate(dateStr) {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

function buildBar(d, sc) {
  if (!d.start || !d.end) {
    return `<div style="font-size:11px;color:var(--text-muted);line-height:28px;padding-left:4px;">No dates set</div>`;
  }

  const startOff = dayOffset(d.start);
  const endOff = dayOffset(d.end);
  const left = Math.max(0, pct(startOff));
  const right = Math.min(100, pct(endOff));
  const width = right - left;
  if (width <= 0) return '';

  const fmtShort = (ds) => {
    const dt = new Date(ds);
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const commentIcon = d.comment
    ? `<span class="bar-comment-icon" data-comment="${escapeAttr(d.comment)}" title="View comment">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </span>`
    : '';

  let html = `<div class="bar bar-${sc}" style="left:${left}%;width:${width}%">
    <span class="bar-date bar-date-start">${fmtShort(d.start)}</span>
    <span class="bar-date bar-date-end">${fmtShort(d.end)}</span>
    ${commentIcon}
  </div>`;

  if (d.completed && d.completed !== d.end) {
    const compOff = dayOffset(d.completed);
    const actualRight = Math.min(100, pct(compOff));
    const actualWidth = actualRight - left;
    if (actualWidth > width) {
      html += `<div class="bar-actual" style="left:${left}%;width:${actualWidth}%"></div>`;
    }
  }

  return html;
}

function addTodayLine() {
  const now = new Date();
  const off = (now - getTimelineStart()) / 864e5;
  const td = totalDays();
  if (off < 0 || off > td) return;

  const p = pct(off);
  document.querySelectorAll('.timeline-cell').forEach((cell) => {
    const line = document.createElement('div');
    line.className = 'today-line';
    line.style.left = `${p}%`;
    cell.appendChild(line);
  });
}

function scrollToToday() {
  const scroll = document.getElementById('ganttScroll');
  const firstLine = document.querySelector('.today-line');
  if (!scroll || !firstLine) return;
  const cell = firstLine.closest('td');
  if (!cell) return;
  const layout = computeLayout();
  const cellLeft = cell.offsetLeft;
  const lineLeftPct = parseFloat(firstLine.style.left) / 100;
  const linePos = cellLeft + cell.offsetWidth * lineLeftPct;
  const visibleWidth = scroll.clientWidth - layout.totalStickyWidth;
  scroll.scrollLeft = linePos - layout.totalStickyWidth - visibleWidth / 2;
}

// ── Sort header click binding ────────────────────────────────────────
let _onRender = null;
export function setRenderCallback(fn) { _onRender = fn; }

function bindSortHeaders() {
  document.querySelectorAll('.sortable[data-sort]').forEach((th) => {
    th.addEventListener('click', (e) => {
      // Don't trigger sort when dragging resize handle
      if (e.target.closest('.col-resize-handle')) return;
      const col = th.dataset.sort;
      if (_sortCol === col) {
        _sortAsc = !_sortAsc;
      } else {
        _sortCol = col;
        _sortAsc = true;
      }
      if (_onRender) _onRender();
    });
  });
}

// ── Column resize (drag) ────────────────────────────────────────────
function bindColumnResize() {
  document.querySelectorAll('.col-resize-handle').forEach((handle) => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const colKey = handle.dataset.col;
      const col = COLUMNS.find((c) => c.key === colKey);
      if (!col) return;

      const startX = e.clientX;
      const startWidth = col.width;

      // Add resize overlay to prevent text selection
      const overlay = document.createElement('div');
      overlay.className = 'resize-overlay';
      document.body.appendChild(overlay);
      document.body.style.cursor = 'col-resize';

      function onMouseMove(ev) {
        const delta = ev.clientX - startX;
        col.width = Math.max(40, startWidth + delta);
        // Live update: recalc all sticky positions
        applyColumnWidths();
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        overlay.remove();
        document.body.style.cursor = '';
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

/**
 * Live-update column widths in the DOM without full re-render.
 */
function applyColumnWidths() {
  const visibleCols = COLUMNS.filter((c) => c.visible);
  let leftAccum = 0;
  const colLeft = {};
  const colWidth = {};

  visibleCols.forEach((col) => {
    colLeft[col.key] = leftAccum;
    colWidth[col.key] = col.width;
    leftAccum += col.width;
  });

  const lastVisibleKey = visibleCols.length > 0 ? visibleCols[visibleCols.length - 1].key : null;

  // Update header cells
  document.querySelectorAll('.gantt-table thead .sticky-col').forEach((th) => {
    const sortKey = th.dataset.sort;
    if (!sortKey || colWidth[sortKey] === undefined) return;
    const w = colWidth[sortKey];
    const isLast = sortKey === lastVisibleKey;
    th.style.left = colLeft[sortKey] + 'px';
    th.style.minWidth = w + 'px';
    th.style.maxWidth = w + 'px';
    th.style.borderRight = isLast ? '2px solid var(--border)' : '';
  });

  // Update body cells
  document.querySelectorAll('.gantt-table tbody tr').forEach((tr) => {
    // Skip group rows - they use colspan
    if (tr.classList.contains('group-row')) {
      const groupCell = tr.querySelector('.group-label-cell');
      if (groupCell) {
        groupCell.style.minWidth = leftAccum + 'px';
        groupCell.style.borderRight = lastVisibleKey ? '2px solid var(--border)' : '';
      }
      return;
    }

    const stickyCells = tr.querySelectorAll('.sticky-col');
    let colIdx = 0;
    stickyCells.forEach((td) => {
      if (colIdx >= visibleCols.length) return;
      const col = visibleCols[colIdx];
      const w = colWidth[col.key];
      const isLast = col.key === lastVisibleKey;
      td.style.left = colLeft[col.key] + 'px';
      td.style.minWidth = w + 'px';
      td.style.maxWidth = w + 'px';
      td.style.borderRight = isLast ? '2px solid var(--border)' : '';
      colIdx++;
    });
  });
}

// ── Group toggle ────────────────────────────────────────────────────
function bindGroupToggle() {
  document.querySelectorAll('.group-row').forEach((row) => {
    row.addEventListener('click', () => {
      const group = row.dataset.group;
      const toggle = row.querySelector('.group-toggle');
      const isCollapsed = _collapsed.has(group);

      if (isCollapsed) {
        _collapsed.delete(group);
        toggle.classList.remove('collapsed');
      } else {
        _collapsed.add(group);
        toggle.classList.add('collapsed');
      }

      document.querySelectorAll(`tr[data-group-member="${CSS.escape(group)}"]`).forEach((r) => {
        r.classList.toggle('group-hidden', !isCollapsed);
      });
    });
  });
}

// ── Comment popover ──────────────────────────────────────────────────
const commentPopover = document.getElementById('commentPopover');

function bindCommentIcons() {
  document.querySelectorAll('.bar-comment-icon').forEach((icon) => {
    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      const comment = icon.dataset.comment;
      const cell = icon.closest('.timeline-cell');
      const d = JSON.parse(cell.dataset.item);

      commentPopover.innerHTML = `
        <div class="comment-popover-header">
          <strong>${escapeHtml(d.detail)}</strong>
          <span class="comment-popover-close">&times;</span>
        </div>
        <div class="comment-popover-body">${escapeHtml(comment)}</div>
      `;
      commentPopover.style.display = 'block';

      // Position near the icon
      const rect = icon.getBoundingClientRect();
      let left = rect.right + 8;
      let top = rect.top - 10;

      // Keep within viewport
      if (left + 300 > window.innerWidth) left = rect.left - 308;
      if (top + 150 > window.innerHeight) top = window.innerHeight - 160;
      if (top < 8) top = 8;

      commentPopover.style.left = left + 'px';
      commentPopover.style.top = top + 'px';

      commentPopover.querySelector('.comment-popover-close').addEventListener('click', () => {
        commentPopover.style.display = 'none';
      });
    });
  });
}

// Close comment popover on outside click
document.addEventListener('click', (e) => {
  if (commentPopover && !commentPopover.contains(e.target) && !e.target.closest('.bar-comment-icon')) {
    commentPopover.style.display = 'none';
  }
});

// ── Tooltip ───────────────────────────────────────────────────────────
const tooltip = document.getElementById('tooltip');

function bindTooltips() {
  document.querySelectorAll('.timeline-cell .bar').forEach((bar) => {
    bar.addEventListener('mouseenter', (e) => {
      const cell = bar.closest('.timeline-cell');
      const d = JSON.parse(cell.dataset.item);
      let h = `<strong>${d.detail}</strong><br>${formatDate(d.start)} \u2192 ${formatDate(d.end)}<br>`;
      if (d.completed) h += `Completed: ${formatDate(d.completed)}<br>`;
      h += `Status: ${d.status}`;
      if (d.version) h += `<br>Version: ${d.version}`;
      tooltip.innerHTML = h;
      tooltip.style.display = 'block';
      moveTooltip(e);
    });
    bar.addEventListener('mousemove', moveTooltip);
    bar.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

function moveTooltip(e) {
  tooltip.style.left = e.clientX + 12 + 'px';
  tooltip.style.top = e.clientY - 10 + 'px';
}
