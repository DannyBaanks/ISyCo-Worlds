import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorldHelperOverlay } from './worlds/WorldHelperOverlay';
import './design/global.css';
import './design/worlds.css';

document.documentElement.style.background = 'transparent';
document.body.style.background = 'transparent';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

const root = document.getElementById('root');
if (!root) throw new Error('Missing GUS overlay root');
createRoot(root).render(<StrictMode><WorldHelperOverlay /></StrictMode>);
