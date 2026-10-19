export type Theme = 'light' | 'dark';
export const THEME_KEY = 'betredge-theme';
const THEME_EVENT = 'betredge-theme-change';
// Synchronous head script: restore before paint without making the layout dynamic.
// New key intentionally ignores preferences from the retired light design.
export const THEME_BOOTSTRAP = `(function(){var t='dark';try{if(localStorage.getItem('${THEME_KEY}')==='light')t='light'}catch(e){}document.documentElement.dataset.theme=t})()`;
export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}
export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* Private/blocked storage: still usable this visit. */ }
  window.dispatchEvent(new Event(THEME_EVENT));
}
export function subscribeTheme(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY && event.key !== null) return;
    document.documentElement.dataset.theme = event.newValue === 'light' ? 'light' : 'dark';
    notify();
  };
  window.addEventListener(THEME_EVENT, notify);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, notify);
    window.removeEventListener('storage', onStorage);
  };
}
