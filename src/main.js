import './styles/variables.css';
import './styles/base.css';
import './styles/header.css';
import './styles/summary.css';
import './styles/filters.css';
import './styles/gantt.css';
import './styles/loading.css';

import { fetchSheetData } from './lib/sheets.js';
import { setData } from './lib/store.js';
import { initDarkMode, toggleDarkMode } from './lib/darkmode.js';
import { renderSummary } from './components/summary.js';
import { renderGantt, setGroupBy, setRenderCallback, initColumnToggle } from './components/gantt.js';
import { populateFilters, getFiltered, getActiveFilterCount, initFilters } from './components/filters.js';
import { SHEET_URL } from './lib/config.js';

// Set datasource link from env
document.getElementById('datasourceLink').href = SHEET_URL;

function render() {
  const items = getFiltered();
  renderSummary(items);
  renderGantt(items);
  updateFilterBadge();
}

function updateFilterBadge() {
  const count = getActiveFilterCount();
  const badge = document.getElementById('filterActiveCount');
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

async function refreshFromSheet() {
  const btn = document.getElementById('btnRefresh');
  const overlay = document.getElementById('loadingOverlay');
  btn.classList.add('spinning');
  overlay.classList.add('active');

  try {
    const data = await fetchSheetData();
    if (data.length > 0) {
      setData(data);
      populateFilters();
      render();
      document.getElementById('lastUpdated').textContent =
        'Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } else {
      alert('Sheet returned no data. Check that the Timeline tab has content.');
    }
  } catch (e) {
    console.error('Refresh failed:', e);
    alert('Could not fetch sheet. Make sure it is publicly accessible (Share > Anyone with the link).\n\n' + e.message);
  } finally {
    btn.classList.remove('spinning');
    overlay.classList.remove('active');
  }
}

// ── Boot ──────────────────────────────────────────────────────────────
initDarkMode();
initFilters(render);
initColumnToggle(render);
setRenderCallback(render);

document.getElementById('btnRefresh').addEventListener('click', refreshFromSheet);
document.getElementById('btnDark').addEventListener('click', toggleDarkMode);

// ── Filter panel open/close ──────────────────────────────────────────
const filterPanel = document.getElementById('filterPanel');
const filterOverlay = document.getElementById('filterOverlay');
const btnFilter = document.getElementById('btnFilter');

function openFilterPanel() {
  filterPanel.classList.add('open');
  filterOverlay.classList.add('active');
  btnFilter.classList.add('active');
}

function closeFilterPanel() {
  filterPanel.classList.remove('open');
  filterOverlay.classList.remove('active');
  btnFilter.classList.remove('active');
}

btnFilter.addEventListener('click', () => {
  if (filterPanel.classList.contains('open')) closeFilterPanel();
  else openFilterPanel();
});
document.getElementById('btnFilterClose').addEventListener('click', closeFilterPanel);
filterOverlay.addEventListener('click', closeFilterPanel);

// Group by — default to "status"
const groupBySelect = document.getElementById('groupBy');
groupBySelect.value = 'status';
setGroupBy('status');
groupBySelect.addEventListener('change', (e) => {
  setGroupBy(e.target.value);
  render();
});

// Auto-load data from Google Sheets on startup
(async () => {
  document.getElementById('lastUpdated').textContent = 'Loading...';
  try {
    const data = await fetchSheetData();
    if (data.length > 0) setData(data);
    document.getElementById('lastUpdated').textContent =
      'Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    console.warn('Auto-load failed:', e);
    document.getElementById('lastUpdated').textContent = 'Offline (no data)';
  }
  populateFilters();
  render();
})();
