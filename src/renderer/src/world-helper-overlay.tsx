import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorldHelperOverlay } from './worlds/WorldHelperOverlay';
import i18n, { LANGUAGES } from './i18n';
import './design/global.css';
import './design/worlds.css';

// The helper lives in its own renderer and shares only localStorage with the
// shell, so it follows the shell's language from there, live.
const applyLanguage = (code: string | null): void => {
  const language = LANGUAGES.find((entry) => entry.code === code) ?? LANGUAGES[0];
  document.documentElement.lang = language.code;
  document.documentElement.dir = language.dir;
  if (i18n.language !== language.code) void i18n.changeLanguage(language.code);
};
try { applyLanguage(window.localStorage.getItem('cth.language')); } catch { applyLanguage(null); }
window.addEventListener('storage', (event) => { if (event.key === 'cth.language') applyLanguage(event.newValue); });

document.documentElement.style.background = 'transparent';
document.body.style.background = 'transparent';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

const root = document.getElementById('root');
if (!root) throw new Error('Missing GUS overlay root');
Object.assign(root.style, { position: 'fixed', inset: '0', pointerEvents: 'none', background: 'transparent' });
createRoot(root).render(<StrictMode><WorldHelperOverlay /></StrictMode>);
