# Astro Export

A small, self-contained web app that generates a complete **astrology data
export** — natal chart, transits, secondary progressions and solar-arc
directions — in one structured, copy-pasteable block of text. Built to replace
the manual "copy each section out of AstroSeek" workflow before pasting into an
LLM like ChatGPT.

Runs entirely in the browser (no server, no account, no network calls). Works
on desktop and on **iPhone/Android via the browser**, and can be added to the
home screen as an installable PWA.

## What it does

- **People** — store several people with birth date, time and place; one is
  always the **default (you)**. Data lives in the browser (`localStorage`).
- **Target time** — a second date/time that defaults to *now*, adjusted through
  a tactile picker: a granularity selector (minute → year), a draggable
  time-scrubber, step buttons, quick presets, and a manual field.
- **One-tap export** — generates all four techniques at once as labelled plain
  text, with a Copy button. Hungarian and English output.

## Calculation

Positions are **tropical, geocentric, referred to the true equinox of date**
(matching astro.com / AstroSeek). The engine is
[astronomy-engine](https://github.com/cosinekitty/astronomy) (MIT, pure JS,
arc-second accuracy) — no ephemeris data files, no WASM.

The astrology layer (`js/astro.js`) is implemented and validated here:

| Component | Method | Validation |
|---|---|---|
| Planet longitudes | ECT ecliptic of date | matches reference ephemeris to ~0.001° |
| Ascendant / MC | standard spherical formulas | exact |
| Placidus houses | converged semi-arc | endpoint-exact (f=0→MC, f=1→ASC) |
| Regiomontanus | equatorial equal division | matches reference to 0.003° |
| Campanus | prime-vertical great-circle intersection | matches reference to 0.003° |
| Koch / Porphyry / Equal / Whole Sign | standard definitions | exact by construction |
| Mean Node, Mean Lilith | Meeus mean-element polynomials | standard |

Techniques:

- **Natal** — positions, house cusps, natal aspects.
- **Transits** — positions at the target time, placed in the natal houses, with
  transit→natal aspects.
- **Secondary progressions** — "a day for a year"; progressed positions and
  progressed→natal aspects.
- **Solar arc** — the progressed-Sun arc applied to every natal point, with
  solar-arc→natal aspects.

Configurable: house system, which aspects to include, which techniques to
export, and language.

Bodies include the ten planets, the mean lunar nodes, mean Lilith (Black Moon),
**Chiron** (from a precomputed Swiss Ephemeris table, `js/chiron.js`, 1900–2100),
plus the Ascendant/MC/Descendant/IC angles, the Vertex and the Part of Fortune.
Aspects are the five classical majors, listed applying/separating, split into a
planet table and a points table matching the AstroSeek layout.

## Running it

It is plain static files — no build step.

The app lives at the repository **root** (so GitHub Pages can serve it with a
clean URL). It is plain static files — no build step.

- **Locally:** serve the repo over HTTP (e.g. `npx serve .`) and open it.
  (Opening `index.html` via `file://` works too, minus the service worker.)
- **GitHub Pages:** repository **Settings → Pages → Deploy from a branch**,
  choose the branch and the `/ (root)` folder. The app then lives at
  `https://<user>.github.io/<repo>/`, which you can bookmark and "Add to Home
  Screen" on iPhone.

A single-file build (everything inlined) is produced for the shareable Claude
Artifact version.

## Files

```
index.html            app shell
css/styles.css        theme-aware styling (light = star-atlas paper, dark = night sky)
js/astronomy.browser.min.js   astronomy-engine (vendored, MIT)
js/cities.js          offline city → lat/lon/timezone lookup
js/astro.js           calculation core + text export
js/app.js             UI, state, date picker
manifest.webmanifest  PWA manifest
sw.js                 offline service worker
icons/                app icons
```

> The repository root also contains an unrelated Python trading-backtest
> project; the files above are the web app.

## Credits

- Ephemeris math: [astronomy-engine](https://github.com/cosinekitty/astronomy)
  by Don Cross (MIT).
