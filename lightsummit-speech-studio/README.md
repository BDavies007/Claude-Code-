# Lightsummit Speech Studio

A standalone React app for writing, rehearsing, and delivering short spoken
scripts at live events. Brief in, script out: it drafts a speech to a word
budget, estimates speaking time, plays it back through the device's own voices
for cadence checks, and reads it off a full-bleed teleprompter with adjustable
roll speed and text size.

## Running it

```sh
npm install
npm run dev        # local dev server
npm run build      # production build in dist/
npm run preview    # serve the production build
```

Built with Vite, React 18, and Tailwind CSS 4.

## API key

Script generation calls the Anthropic Messages API directly from the browser
using Anthropic's CORS support (the `anthropic-dangerous-direct-browser-access`
header). Paste an API key into the field below the brief — it is stored in
`localStorage` on that device only and sent nowhere except `api.anthropic.com`.

This is the right trade-off for a personal tool on your own machine. If you
ever deploy this for other people, move the API call behind a small backend
that holds the key server-side instead — never ship a shared key to browsers.

## Storage

Saved speeches live in `localStorage` via a small shim (`src/storage.js`) that
mirrors the Claude artifact storage API the component was originally written
against, so the component works unchanged in both environments.

## Layout

- `src/SpeechStudio.jsx` — the whole app: brief form, script editor with
  timing meter, rehearsal playback (Web Speech API), teleprompter,
  copy/download export, and a 20-entry archive.
- `src/storage.js` — localStorage-backed shim for `window.storage`.
- `src/main.jsx`, `index.html`, `vite.config.js` — standard Vite scaffolding.
