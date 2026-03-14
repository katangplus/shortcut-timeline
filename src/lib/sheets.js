import { SHEET_ID, SHEET_GID } from './config.js';

/**
 * Parse a gviz date cell into ISO date string (YYYY-MM-DD).
 * Handles both "Date(y,m,d)" format and formatted text values.
 */
function parseGvizDate(cell) {
  if (!cell) return null;

  // gviz returns dates as "Date(year,month,day)" where month is 0-indexed
  if (cell.v && typeof cell.v === 'string' && cell.v.startsWith('Date(')) {
    const nums = cell.v.match(/Date\((\d+),(\d+),(\d+)\)/);
    if (nums) {
      const d = new Date(+nums[1], +nums[2], +nums[3]);
      return d.toISOString().slice(0, 10);
    }
  }

  const fv = (cell.f || cell.v || '').toString().trim();
  if (!fv) return null;

  // Try "D Mon YYYY" format
  const parts = fv.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (parts) {
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const m = months[parts[2]];
    if (m !== undefined) {
      return new Date(+parts[3], m, +parts[1]).toISOString().slice(0, 10);
    }
  }

  // Try ISO-ish
  const iso = new Date(fv);
  if (!isNaN(iso)) return iso.toISOString().slice(0, 10);

  return null;
}

function cellValue(cell) {
  if (!cell) return '';
  return (cell.f || (cell.v != null ? String(cell.v) : '')).trim();
}

/**
 * Convert a gviz table response into our data model.
 */
function gvizToData(table) {
  const items = [];
  for (const row of table.rows) {
    const c = row.c || [];
    const no = c[1] && c[1].v ? Number(c[1].v) : 0;
    const module = cellValue(c[2]);
    const detail = cellValue(c[3]);
    const start = parseGvizDate(c[4]);
    const end = parseGvizDate(c[5]);
    const status = cellValue(c[6]);
    const version = cellValue(c[7]);
    const completed = parseGvizDate(c[8]);
    const comment = cellValue(c[9]);

    if (!module && !detail && !status) continue;
    items.push({ no, module, detail, start, end, status, version, completed, comment });
  }
  return items;
}

/**
 * Fetch data from Google Sheets using the gviz JSONP API.
 * Works cross-origin without any server proxy.
 */
export function fetchSheetData() {
  return new Promise((resolve, reject) => {
    const callbackName = '_gvizCb_' + Date.now();
    const script = document.createElement('script');

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Request timed out'));
    }, 15000);

    function cleanup() {
      clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function (response) {
      cleanup();
      try {
        if (response.status === 'error') {
          reject(new Error(response.errors.map((e) => e.message).join(', ')));
          return;
        }
        resolve(gvizToData(response.table));
      } catch (e) {
        reject(e);
      }
    };

    const url =
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
      `?tqx=out:json;responseHandler:${callbackName}` +
      `&gid=${SHEET_GID}&_t=${Date.now()}`;

    script.src = url;
    script.onerror = () => {
      cleanup();
      reject(new Error('Network error loading sheet'));
    };
    document.body.appendChild(script);
  });
}
