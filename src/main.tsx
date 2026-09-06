// Must come first: it moves `kraken.*` localStorage keys to `octo.*` before
// any store reads them at module-evaluation time.
import './lib/migrateStorage';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { WideApp } from './components/wide/WideApp';
import './lib/prism';
// Fonts ship WITH the app. They used to come from Google Fonts over the
// network, which meant a packaged or offline Octo silently fell back to the
// system UI font — the app looked like a different app depending on the wifi.
import '@fontsource-variable/hanken-grotesk';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';

// Same bundle, two entry points: the #wide hash (set by the main process when it
// opens the Travel Display) renders the compact fleet monitor instead of the app.
const Root = window.octo.win.isWideRenderer() ? WideApp : App;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
