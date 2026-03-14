/**
 * Timeline range utilities for the Gantt chart.
 */

// Default: 8 months before today to 6 months after today
const now = new Date();
const DEFAULT_MIN = new Date(now.getFullYear(), now.getMonth() - 8, 1);
const DEFAULT_MAX = new Date(now.getFullYear(), now.getMonth() + 7, 1);

let _start = new Date(DEFAULT_MIN);
let _end = new Date(DEFAULT_MAX);

export function getTimelineStart() { return _start; }
export function getTimelineEnd() { return _end; }

export function setTimelineRange(start, end) {
  _start = start || new Date(DEFAULT_MIN);
  _end = end || new Date(DEFAULT_MAX);
  if (_start >= _end) {
    _end = new Date(_start);
    _end.setMonth(_end.getMonth() + 1);
  }
}

export function resetTimelineRange() {
  _start = new Date(DEFAULT_MIN);
  _end = new Date(DEFAULT_MAX);
}

export function getMonths() {
  const months = [];
  const d = new Date(_start);
  while (d < _end) {
    months.push(new Date(d));
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

export function totalDays() {
  return (_end - _start) / 864e5;
}

export function dayOffset(dateStr) {
  if (!dateStr) return null;
  return (new Date(dateStr) - _start) / 864e5;
}

export function pct(days) {
  return (days / totalDays()) * 100;
}

export function formatDate(d) {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
