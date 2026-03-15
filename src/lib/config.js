export const SHEET_ID = import.meta.env.SHORTCUT_SHEET_ID;
export const SHEET_GID = import.meta.env.SHORTCUT_SHEET_GID;
export const SHEET_NAME = import.meta.env.SHORTCUT_SHEET_NAME || 'Timeline';
export const GOOGLE_CLIENT_ID = import.meta.env.SHORTCUT_GOOGLE_CLIENT_ID;
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${SHEET_GID}#gid=${SHEET_GID}`;

export const STATUS_ORDER = ['Complete', 'WIP', 'Pending', 'Requirement', 'To Do'];

export const STATUS_CLASS_MAP = {
  Complete: 'complete',
  WIP: 'wip',
  Pending: 'pending',
  Requirement: 'requirement',
  'To Do': 'todo',
};

export function statusClass(status) {
  return STATUS_CLASS_MAP[status] || 'todo';
}
