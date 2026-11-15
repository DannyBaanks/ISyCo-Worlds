import { createRoot } from 'react-dom/client';
import { WorldPresentationHost } from './worlds/WorldPresentationHost';
import i18n, { LANGUAGES } from './i18n';
import './design/fonts.css';
import './design/village-hud.css';

// The scene runs in its own renderer and shares only localStorage with the app
// shell. Follow the shell's language and theme, at start and when they change.
const LANGUAGE_KEY = 'cth.language';
const THEME_KEY = 'cth.theme';

function applyLanguage(code: string | null): void {
  const language = LANGUAGES.find((entry) => entry.code === code) ?? LANGUAGES[0];
  document.documentElement.lang = language.code;
  document.documentElement.dir = language.dir;
  if (i18n.language !== language.code) void i18n.changeLanguage(language.code);
}

function applyTheme(value: string | null): void {
  const next = value === 'dark' ? 'dark' : 'light';
  if (document.documentElement.dataset.cthTheme !== next) document.documentElement.dataset.cthTheme = next;
}

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

applyLanguage(read(LANGUAGE_KEY));
applyTheme(read(THEME_KEY));
window.addEventListener('storage', (event) => {
  if (event.key === LANGUAGE_KEY) applyLanguage(event.newValue);
  if (event.key === THEME_KEY) applyTheme(event.newValue);
});
// The storage event does not reliably cross into this view in the packaged app
// (file:// pages in separate renderers), so also re-read on a slow timer. Two
// localStorage reads a second is negligible, and a toggle lands within it.
window.setInterval(() => {
  applyLanguage(read(LANGUAGE_KEY));
  applyTheme(read(THEME_KEY));
}, 1000);

const element = document.getElementById('world-root');
if (!element) throw new Error('world presentation root is missing');

createRoot(element).render(<WorldPresentationHost />);
