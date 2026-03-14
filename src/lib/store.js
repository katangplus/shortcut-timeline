/**
 * Simple reactive data store.
 * Holds the sheet data and notifies listeners on change.
 */

let _data = [];
const _listeners = new Set();

export function getData() {
  return _data;
}

export function setData(items) {
  _data = items;
  _listeners.forEach((fn) => fn(_data));
}

export function onDataChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
