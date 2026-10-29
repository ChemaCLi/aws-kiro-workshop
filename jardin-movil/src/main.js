import { store } from './core/store.js';
import { startTicker } from './core/ticker.js';
import './components/tasks-view.js';
import './components/focus-view.js';
import './components/garden-view.js';
import './components/stats-view.js';
import './components/app-shell.js';

startTicker(store);
