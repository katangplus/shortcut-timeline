import './styles/variables.css';
import './styles/base.css';
import './styles/auth.css';
import './styles/header.css';
import './styles/summary.css';
import './styles/filters.css';
import './styles/gantt.css';
import './styles/loading.css';

import { initAuth, signIn, signOut, isSignedIn, getUserEmail, getAccessToken } from './lib/auth.js';
import { checkSheetAccess } from './lib/permissions.js';
import { fetchSheetData } from './lib/sheets.js';
import { setData } from './lib/store.js';
import { initDarkMode, toggleDarkMode } from './lib/darkmode.js';
import { renderSummary } from './components/summary.js';
import { renderGantt, setGroupBy, setRenderCallback, initColumnToggle } from './components/gantt.js';
import { populateFilters, getFiltered, getActiveFilterCount, initFilters } from './components/filters.js';
import { SHEET_URL } from './lib/config.js';

// ── Screen helpers ───────────────────────────────────────────────────
const loginScreen = document.getElementById('loginScreen');
const permissionDenied = document.getElementById('permissionDenied');
const dashboardContent = document.getElementById('dashboardContent');
const authLoading = document.getElementById('authLoading');

function showLogin() {
  loginScreen.style.display = '';
  permissionDenied.style.display = 'none';
  dashboardContent.style.display = 'none';
  authLoading.style.display = 'none';
}

function showDenied(email) {
  loginScreen.style.display = 'none';
  permissionDenied.style.display = '';
  dashboardContent.style.display = 'none';
  document.getElementById('deniedEmail').textContent = email || '';
}

function showDashboard(email) {
  loginScreen.style.display = 'none';
  permissionDenied.style.display = 'none';
  dashboardContent.style.display = '';
  document.getElementById('userEmail').textContent = email || '';
}

// ── Dashboard logic ──────────────────────────────────────────────────
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

async function loadData() {
  document.getElementById('lastUpdated').textContent = 'Loading...';
  try {
    const data = await fetchSheetData();
    if (data.length > 0) setData(data);
    document.getElementById('lastUpdated').textContent =
      'Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    console.warn('Load failed:', e);
    if (e.message.includes('expired')) {
      handleSignOut();
      return;
    }
    document.getElementById('lastUpdated').textContent = 'Error loading data';
  }
  populateFilters();
  render();
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
    if (e.message.includes('expired')) {
      handleSignOut();
      return;
    }
    alert('Could not fetch sheet.\n\n' + e.message);
  } finally {
    btn.classList.remove('spinning');
    overlay.classList.remove('active');
  }
}

// ── Auth flow ────────────────────────────────────────────────────────
async function handleSignIn() {
  authLoading.style.display = '';
  authLoading.textContent = 'Checking access...';
  try {
    const { accessToken, email } = await signIn();
    try {
      const hasAccess = await checkSheetAccess(accessToken);
      if (hasAccess) {
        bootDashboard(email);
      } else {
        showDenied(email);
      }
    } catch (permErr) {
      console.error('Permission check failed:', permErr);
      authLoading.textContent = 'Error: ' + permErr.message;
      setTimeout(() => showLogin(), 3000);
    }
  } catch (e) {
    console.error('Sign in failed:', e);
    authLoading.style.display = 'none';
  }
}

function handleSignOut() {
  signOut();
  showLogin();
}

function bootDashboard(email) {
  showDashboard(email);
  document.getElementById('datasourceLink').href = SHEET_URL;
  initFilters(render);
  initColumnToggle(render);
  setRenderCallback(render);

  document.getElementById('btnRefresh').addEventListener('click', refreshFromSheet);
  document.getElementById('btnDark').addEventListener('click', toggleDarkMode);

  // Filter panel open/close
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

  // Load data
  loadData();
}

// ── Boot ─────────────────────────────────────────────────────────────
initDarkMode();

document.getElementById('btnGoogleSignIn').addEventListener('click', handleSignIn);
document.getElementById('btnTryAnother').addEventListener('click', handleSignIn);
document.getElementById('btnSignOut').addEventListener('click', handleSignOut);
document.getElementById('btnHeaderSignOut').addEventListener('click', handleSignOut);

(async () => {
  try {
    await initAuth();

    // Check if already signed in (from sessionStorage)
    if (isSignedIn()) {
      authLoading.style.display = '';
      authLoading.textContent = 'Checking access...';
      try {
        const token = getAccessToken();
        const hasAccess = await checkSheetAccess(token);
        if (hasAccess) {
          bootDashboard(getUserEmail());
        } else {
          showDenied(getUserEmail());
        }
      } catch (e) {
        console.error('Session check failed:', e);
        signOut();
        showLogin();
      }
    } else {
      showLogin();
    }
  } catch (e) {
    console.error('Auth init failed:', e);
    showLogin();
  }
})();
