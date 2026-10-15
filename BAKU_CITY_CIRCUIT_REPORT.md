# Baku City Circuit Strategy Report

## Scope

This prototype is configured for **Azerbaijan · Baku City Circuit only**. Other circuit choices have been removed from the user experience and the API rejects non-Baku circuit keys.

## Track profile

- Circuit: Baku City Circuit
- Length: 6.003 km
- Character: high-speed street circuit
- Default pit-lane loss: 23.0 seconds
- Strategy model: illustrative, rule-based, and simulated

## Inputs modeled

- Current lap and race distance
- Current tyre compound and tyre age
- Tyre compound after the stop
- Pit-lane loss assumption
- Rain probability
- Safety Car state

## Outputs

The model compares:

1. Pit now
2. Stay out for up to four laps, then pit

The dashboard shows estimated total loss, tyre degradation, weather exposure, pit timing, animated race replay, and lap-by-lap cumulative modeled loss.

## Important limitation

This is a transparent hackathon demo. It does not use live timing, official telemetry, weather feeds, or verified race predictions.

## Run

```powershell
py -3.13 server.py
```

Open the dashboard through Live Server or at `http://127.0.0.1:8000/`.
