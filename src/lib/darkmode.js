const STORAGE_KEY = 'darkMode';

export function initDarkMode() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'true' || (saved === null && preferDark)) {
    setDark(true);
  }
  updateIcons();
}

export function toggleDarkMode() {
  const isDark = !document.documentElement.classList.contains('dark');
  setDark(isDark);
}

function setDark(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem(STORAGE_KEY, isDark);
  updateIcons();
}

function updateIcons() {
  const isDark = document.documentElement.classList.contains('dark');
  const sun = document.getElementById('iconSun');
  const moon = document.getElementById('iconMoon');
  if (sun) sun.style.display = isDark ? 'none' : '';
  if (moon) moon.style.display = isDark ? '' : 'none';
}
