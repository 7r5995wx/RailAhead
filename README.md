# RailAhead

🚀 **Live Demo:** [https://railahead.vercel.app](https://railahead.vercel.app)

A Vercel-ready Indian Railways departure board. Its rule is simple: only remove a train after the live feed says it has departed the source station. Therefore a delayed train remains catchable even after its scheduled departure time.

## Run or deploy

### Local preview

Use the included server instead of `python -m http.server`; it implements the `/api/trains` route used by the website:

```bash
cd /Users/vishalkumar/Desktop/RailAhead
python3 dev_server.py
```

Open http://localhost:4173. Create a local `.env` file with `RAILRADAR_API_KEY=your_key` (it is ignored by Git). Without an API key, searches display demo data rather than a static-server 404.

### Vercel deployment

1. Import this folder into a Vercel project.
2. In Vercel's environment-variable settings, add `RAILRADAR_API_KEY` (see `.env.example`).
3. Deploy. The browser calls the protected `/api/trains` endpoint; the provider key never reaches it.

Without the key, the UI remains usable in demo mode. The production endpoint requests RailRadar's `trains/between` endpoint with `live=true`, caches replies for one minute, and filters `departed`, `cancelled`, and `skipped` services.

The current-station control asks for browser location only when tapped and calculates the nearest result locally. It currently has a starter directory of major stations; replace that directory with the provider's complete station data before launch.

For the current starter directory, select the suggested station format—for example **Patna Junction (PNBE)** rather than free-typing a district name. Common short forms such as `Patna` and `New Delhi` are resolved automatically.

RailRadar's provider documentation: https://railradar.in/docs/trains-between-stations
