# Lightsummit Speech Studio

A single-file React component for writing, rehearsing, and delivering short
spoken scripts at live events. Brief in, script out: it drafts a speech to a
word budget, estimates speaking time, plays it back through the device's own
voices for cadence checks, and reads it off a full-bleed teleprompter with
adjustable roll speed and text size.

## Contents

- `SpeechStudio.jsx` — the whole app: brief form, script editor with timing
  meter, rehearsal playback (Web Speech API), teleprompter, copy/download
  export, and a 20-entry local archive.

## Runtime notes

The component was built as a Claude artifact and depends on that environment
in two places:

- **Script generation** calls `https://api.anthropic.com/v1/messages` with no
  API key — inside a Claude artifact the request is proxied and authenticated
  for you. To run it anywhere else, route the call through your own backend
  that attaches an `x-api-key` header (never ship the key to the browser).
- **The archive** uses `window.storage.get`/`window.storage.set`, the artifact
  storage API. Outside an artifact, swap these for `localStorage` or your own
  persistence.

Styling assumes Tailwind CSS utility classes are available; the visual system
(ink-on-paper palette, Georgia manuscript type) is otherwise self-contained
via inline styles.
