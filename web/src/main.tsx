import { createRoot } from 'react-dom/client';
import '@fontsource-variable/atkinson-hyperlegible-next';
import './index.css';
import App from './App';

// No StrictMode: its double mount would build the WebGL map twice in development.
createRoot(document.getElementById('root')!).render(<App />);
