# Zero Hour Pitwall Strategist — Project Report

**Project type:** Local Formula 1 strategy-analysis prototype  
**Status:** Working  
**Configuration:** Baku City Circuit only  
**Date:** 2026-10-15

## 1. Project purpose

Zero Hour Pitwall Strategist is a local browser dashboard that compares two pit-stop decisions under editable race conditions:

- **Pit now**
- **Stay out for up to four laps, then pit**

The project is designed as an explainable hackathon prototype. It does not claim to provide official telemetry, live timing, or validated race predictions.

## 2. Project files

| File | Responsibility |
|---|---|
| [`index.html`](./index.html) | Dashboard structure, scenario form, strategy output, race replay, and simulation display. |
| [`styles.css`](./styles.css) | Dark pit-wall visual design, responsive layout, track replay, charts, cards, and controls. |
| [`app.js`](./app.js) | Form handling, API calls, result rendering, animated car blips, charts, and lap-by-lap visualization. |
| [`server.py`](./server.py) | Standard-library HTTP server, static assets, validation, strategy model, and JSON API. |
| [`README.md`](./README.md) | Basic setup and API usage notes. |
| [`BAKU_CITY_CIRCUIT_REPORT.md`](./BAKU_CITY_CIRCUIT_REPORT.md) | Focused Baku circuit report. |

## 3. Runtime architecture

```text
Browser / Live Server :5500
        │
        │ POST /api/strategy/compare
        ▼
Python API :8000
        │
        ├─ validates scenario inputs
        ├─ compares pit strategies
        └─ returns strategy + simulation JSON
```

The Python server uses only the standard library. No external network connection or package installation is required.

## 4. Baku-only configuration

The application and API support only:

- **Circuit:** Azerbaijan · Baku City Circuit
- **Length:** 6.003 km
- **Corners:** 20
- **DRS zones:** 2
- **Character:** High-speed street circuit
- **Default pit-lane loss:** 23.0 seconds

The browser selector contains only Baku. The API rejects other circuit keys with a validation error.

## 5. Inputs

The scenario form allows the user to edit:

- Current lap
- Total race laps
- Current tyre compound
- Current tyre age
- Tyre compound after the stop
- Pit-lane loss assumption
- Rain probability
- Safety Car state

The current defaults are illustrative values for a 53-lap scenario.

## 6. Strategy model

The model estimates loss in seconds using simple, visible rules:

### Tyre degradation

Each compound has a fictional degradation coefficient:

| Compound | Rate |
|---|---:|
| Soft | 0.12 |
| Medium | 0.085 |
| Hard | 0.06 |

Loss increases with tyre age using a power curve and ignores the first two low-degradation laps.

### Weather exposure

Rain probability above 20% adds a small expected slick-tyre exposure cost per lap. The model does not simulate intermediate or wet tyres.

### Safety Car

When active, effective pit loss is multiplied by `0.62`, representing a simplified 38% reduction.

### Strategy comparison

The API calculates total modeled loss for an immediate stop and for waiting up to four laps. The lower total is returned as the recommendation, together with the estimated edge over the alternative.

## 7. Simulation output

The API also returns a lap-by-lap timeline for both strategies. Each simulated lap includes:

- Lap number
- Compound
- Tyre age
- Tyre loss
- Weather loss
- Pit loss, when the stop occurs
- Lap loss
- Cumulative loss
- Pit-stop marker

The dashboard uses this data for:

- Cumulative loss bars
- Animated race replay
- Moving car blips for the recommended and alternative strategies
- Track sectors and Baku track specifications
- Play/pause replay control

## 8. API endpoints

### Health check

```http
GET http://127.0.0.1:8000/api/health
```

### Strategy comparison

```http
POST http://127.0.0.1:8000/api/strategy/compare
Content-Type: application/json
```

Example request:

```json
{
  "circuit": "baku",
  "current_lap": 31,
  "total_laps": 53,
  "current_compound": "MEDIUM",
  "tyre_age": 18,
  "next_compound": "HARD",
  "pit_loss_seconds": 23,
  "rain_probability": 20,
  "safety_car": false
}
```

The API supports CORS and handles `OPTIONS` preflight requests so the frontend can run from Live Server on port 5500 while the API runs on port 8000.

## 9. Running the project

Start the backend from the project directory:

```powershell
py -3.13 server.py
```

Then either:

- Open `http://127.0.0.1:8000/`, or
- Start VS Code Live Server and open `http://127.0.0.1:5500/index.html`.

When using Live Server, keep both the Live Server process and `server.py` running.

## 10. Validation completed

The working configuration has been checked with:

- API health response: HTTP 200
- Baku strategy comparison: HTTP 200
- Non-Baku strategy request: HTTP 400
- Simulation timeline generated for both strategy options
- Browser rendering of the Baku replay and track specifications
- Python diagnostics: no errors
- JavaScript diagnostics: no errors

## 11. Limitations and next steps

This project is intentionally transparent and illustrative. It does not include:

- Live F1 timing or telemetry
- Real weather data
- Driver-specific pace models
- Traffic, undercut/overcut interaction, or pit-entry queue modeling
- Wet-weather tyre selection
- Official Baku race data validation

Possible future improvements include importing real timing data, adding sector-level pace, modeling traffic risk, and calibrating degradation coefficients against historical Baku sessions.
