import { SHEET_ID } from './config.js';

/**
 * Check if the authenticated user has access to the Google Sheet.
 * Makes a lightweight metadata-only request.
 * Returns true if access granted, false if denied.
 */
export async function checkSheetAccess(accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=properties.title`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.ok) return true;
  if (res.status === 403 || res.status === 404) return false;

  // Log detailed error for debugging
  let detail = '';
  try { detail = await res.text(); } catch { /* ignore */ }
  console.error('Sheet access check failed:', res.status, detail);
  throw new Error(`Sheet access check failed (${res.status}). Make sure Google Sheets API is enabled in your Google Cloud project.`);
}
