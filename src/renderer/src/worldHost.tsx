import { createRoot } from 'react-dom/client';
import { WorldPresentationHost } from './worlds/WorldPresentationHost';
import './design/fonts.css';

const element = document.getElementById('world-root');
if (!element) throw new Error('world presentation root is missing');

createRoot(element).render(<WorldPresentationHost />);
