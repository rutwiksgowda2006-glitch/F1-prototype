# Zero Hour · Pitwall Strategy

A small, local Formula 1 strategy-comparison website for the Zero Hour prototype. It supports the four specified circuits and calls a local JSON API. It uses only Python's standard library and works without internet access.

## Run it

1. Open this folder in VS Code.
2. In the integrated terminal, run `python server.py`.
3. Open `http://127.0.0.1:8000` in a browser.
4. Change the scenario and press **Run Strategy Comparison**.

Keep the terminal running while the page is open. Press `Ctrl+C` in the terminal to stop the local server.

## API

Health check: `GET /api/health`

Strategy comparison: `POST /api/strategy/compare` with JSON like:

```json
{
  "circuit": "monaco",
  "current_lap": 31,
  "total_laps": 53,
  "current_compound": "MEDIUM",
  "tyre_age": 18,
  "next_compound": "HARD",
  "pit_loss_seconds": 24.5,
  "rain_probability": 20,
  "safety_car": false
}
```

Valid circuit keys: `baku`, `madring`, `monaco`, `marina_bay`.

## Important limits

- All pit-lane loss defaults and tyre degradation rates are illustrative assumptions, not official circuit telemetry.
- The Safety Car discount and rain adjustment are simplified demo rules.
- This is not a trained model, live timing feed, or scientifically validated F1 simulator. Describe it as an explainable prototype and show its assumptions in the demo.
- All code in this folder was created during the event session. The earlier interpreter warm-up is separate and contains no racing logic.
