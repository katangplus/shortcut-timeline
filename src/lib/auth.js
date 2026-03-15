import { GOOGLE_CLIENT_ID } from './config.js';

let _tokenClient = null;
let _accessToken = null;
let _expiresAt = 0;
let _userEmail = null;

function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

export async function initAuth() {
  await loadGisScript();

  // Initialize token client once
  _tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly email profile',
    callback: () => {}, // overridden per signIn call
    error_callback: () => {}, // overridden per signIn call
  });

  // Restore token from sessionStorage
  const stored = sessionStorage.getItem('gauth');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.expiresAt > Date.now()) {
        _accessToken = parsed.accessToken;
        _expiresAt = parsed.expiresAt;
        _userEmail = parsed.email;
      } else {
        sessionStorage.removeItem('gauth');
      }
    } catch { /* ignore */ }
  }
}

export function signIn() {
  return new Promise((resolve, reject) => {
    // Override callbacks for this sign-in attempt
    _tokenClient.callback = async (response) => {
      if (response.error) {
        console.error('OAuth error:', response);
        reject(new Error(response.error_description || response.error));
        return;
      }
      _accessToken = response.access_token;
      _expiresAt = Date.now() + (response.expires_in * 1000);

      // Fetch user email
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${_accessToken}` },
        });
        const info = await res.json();
        _userEmail = info.email || null;
      } catch { _userEmail = null; }

      // Persist to sessionStorage
      sessionStorage.setItem('gauth', JSON.stringify({
        accessToken: _accessToken,
        expiresAt: _expiresAt,
        email: _userEmail,
      }));

      resolve({ accessToken: _accessToken, email: _userEmail });
    };

    _tokenClient.error_callback = (error) => {
      console.error('GIS error_callback:', error);
      reject(new Error(error.message || error.type || 'Sign-in popup was closed'));
    };

    _tokenClient.requestAccessToken();
  });
}

export function signOut() {
  if (_accessToken) {
    window.google.accounts.oauth2.revoke(_accessToken, () => {});
  }
  _accessToken = null;
  _expiresAt = 0;
  _userEmail = null;
  sessionStorage.removeItem('gauth');
}

export function getAccessToken() {
  if (_accessToken && _expiresAt > Date.now()) return _accessToken;
  return null;
}

export function getUserEmail() {
  return _userEmail;
}

export function isSignedIn() {
  return !!getAccessToken();
}
