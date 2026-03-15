import { SHEET_ID, SHEET_NAME } from './config.js';
import { getAccessToken } from './auth.js';

/**
 * Parse a date string into ISO date (YYYY-MM-DD).
 * Handles: "D Mon YYYY", "YYYY-MM-DD", "MM/DD/YYYY", etc.
 */
function parseDate(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (!str) return null;

  // "D Mon YYYY" or "DD Mon YYYY"
  const parts = str.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (parts) {
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const m = months[parts[2]];
    if (m !== undefined) {
      return new Date(+parts[3], m, +parts[1]).toISOString().slice(0, 10);
    }
  }

  // Google Sheets serial date number (days since 1899-12-30)
  if (/^\d{5}$/.test(str)) {
    const d = new Date(1899, 11, 30 + Number(str));
    return d.toISOString().slice(0, 10);
  }

  // ISO or other parseable format
  const iso = new Date(str);
  if (!isNaN(iso)) return iso.toISOString().slice(0, 10);

  return null;
}

/**
 * Convert Sheets API v4 values array into our data model.
 * First row is the header; data starts from row 2.
 * Columns: A=?, B=no, C=module, D=detail, E=start, F=end, G=status, H=version, I=completed, J=comment
 */
function valuesToData(values) {
  if (!values || values.length < 2) return [];

  const items = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.length === 0) continue;

    const no = row[1] ? Number(row[1]) : 0;
    const module = (row[2] || '').trim();
    const detail = (row[3] || '').trim();
    const start = parseDate(row[4]);
    const end = parseDate(row[5]);
    const status = (row[6] || '').trim();
    const version = (row[7] || '').trim();
    const completed = parseDate(row[8]);
    const comment = (row[9] || '').trim();

    if (!module && !detail && !status) continue;
    items.push({ no, module, detail, start, end, status, version, completed, comment });
  }
  return items;
}

/**
 * Fetch data from Google Sheets using the Sheets API v4 (authenticated).
 */
export async function fetchSheetData() {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) throw new Error('Session expired. Please sign in again.');
  if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);

  const data = await res.json();
  return valuesToData(data.values);
}
