"""Zero Hour Pit Strategist: local demo API and static website server.

Run with Python 3: python server.py
Uses only Python's standard library; no internet connection is required.
The strategy math is illustrative and is not an official race simulation.
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8000

# Editable, illustrative pit-loss assumptions in seconds, not official telemetry.
CIRCUITS = {
    "baku": {"name": "Azerbaijan · Baku City Circuit", "pit_loss": 23.0},
}

# Track specifications used by the Baku-only replay display.
TRACK_SPECS = {
    "baku": {"length_km": 6.003, "corners": 20, "drs_zones": 2, "character": "High-speed street circuit"},
}

# Simple fictional degradation coefficients, seconds per increasingly old lap.
TYRE_RATE = {"SOFT": 0.12, "MEDIUM": 0.085, "HARD": 0.06}
WAIT_LAPS = 4
SAFETY_CAR_PIT_FACTOR = 0.62


def _number(payload: dict[str, Any], key: str, low: float, high: float) -> float:
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{key} must be a number")
    if not low <= value <= high:
        raise ValueError(f"{key} must be between {low:g} and {high:g}")
    return float(value)


def tyre_loss(compound: str, starting_age: int, laps: int) -> float:
    """Approximate accumulated pace loss relative to a fresh tyre."""
    rate = TYRE_RATE[compound]
    return sum(rate * max(0, age - 2) ** 1.12 for age in range(starting_age + 1, starting_age + laps + 1))


def rain_exposure(compound: str, rain_probability: float, laps: int) -> float:
    """Small expected-risk adjustment; intentionally simple and visible."""
    if compound in {"SOFT", "MEDIUM", "HARD"}:
        return laps * max(0.0, rain_probability - 20.0) / 80.0 * 0.16
    return 0.0


def simulation_timeline(
    current_lap: int,
    remaining: int,
    wait: int,
    current_compound: str,
    tyre_age: int,
    next_compound: str,
    rain_probability: float,
    effective_pit_loss: float,
) -> list[dict[str, Any]]:
    """Build a lap-by-lap explanation of the modeled loss for one strategy."""
    timeline: list[dict[str, Any]] = []
    cumulative = 0.0
    for offset in range(1, remaining + 1):
        after_stop = offset > wait
        compound = next_compound if after_stop else current_compound
        age = offset - wait - 1 if after_stop else tyre_age + offset - 1
        pit_loss = effective_pit_loss if offset == wait + 1 else 0.0
        tyre_loss_value = tyre_loss(compound, age, 1)
        weather_loss = rain_exposure(compound, rain_probability, 1)
        lap_loss = pit_loss + tyre_loss_value + weather_loss
        cumulative += lap_loss
        timeline.append(
            {
                "lap": current_lap + offset,
                "pit_loss": round(pit_loss, 1),
                "tyre_loss": round(tyre_loss_value, 1),
                "weather_loss": round(weather_loss, 1),
                "lap_loss": round(lap_loss, 1),
                "cumulative_loss": round(cumulative, 1),
                "compound": compound,
                "tyre_age": age + 1,
                "pit_stop": pit_loss > 0,
            }
        )
    return timeline


def compare_strategy(payload: dict[str, Any]) -> dict[str, Any]:
    circuit_key = payload.get("circuit")
    if circuit_key not in CIRCUITS:
        raise ValueError("Only Baku City Circuit is supported")

    circuit = CIRCUITS[circuit_key]
    current_lap = int(_number(payload, "current_lap", 1, 100))
    total_laps = int(_number(payload, "total_laps", 2, 120))
    if current_lap >= total_laps:
        raise ValueError("Current lap must be before the final lap")

    tyre_age = int(_number(payload, "tyre_age", 0, 100))
    pit_loss = _number(payload, "pit_loss_seconds", 0, 60)
    rain_probability = _number(payload, "rain_probability", 0, 100)
    current_compound = str(payload.get("current_compound", "MEDIUM")).upper()
    next_compound = str(payload.get("next_compound", "HARD")).upper()
    if current_compound not in TYRE_RATE or next_compound not in TYRE_RATE:
        raise ValueError("Compounds must be Soft, Medium, or Hard")
    safety_car = payload.get("safety_car")
    if not isinstance(safety_car, bool):
        raise ValueError("safety_car must be true or false")

    remaining = total_laps - current_lap
    wait = min(WAIT_LAPS, max(0, remaining - 1))
    effective_pit_loss = pit_loss * (SAFETY_CAR_PIT_FACTOR if safety_car else 1.0)

    now_new_tyre_loss = tyre_loss(next_compound, 0, remaining)
    now_rain_loss = rain_exposure(next_compound, rain_probability, remaining)
    pit_now_total = effective_pit_loss + now_new_tyre_loss + now_rain_loss

    stay_old_loss = tyre_loss(current_compound, tyre_age, wait)
    stay_new_loss = tyre_loss(next_compound, 0, remaining - wait)
    stay_rain_loss = rain_exposure(current_compound, rain_probability, wait)
    stay_rain_loss += rain_exposure(next_compound, rain_probability, remaining - wait)
    wait_total = stay_old_loss + effective_pit_loss + stay_new_loss + stay_rain_loss

    options = [
        {
            "key": "pit_now",
            "label": "Pit now",
            "pit_lap": current_lap,
            "total_loss": round(pit_now_total, 1),
            "pit_loss": round(effective_pit_loss, 1),
            "tyre_loss": round(now_new_tyre_loss, 1),
            "weather_adjustment": round(now_rain_loss, 1),
        },
        {
            "key": "stay_out",
            "label": f"Stay out {wait} laps, then pit",
            "pit_lap": current_lap + wait,
            "total_loss": round(wait_total, 1),
            "pit_loss": round(effective_pit_loss, 1),
            "tyre_loss": round(stay_old_loss + stay_new_loss, 1),
            "weather_adjustment": round(stay_rain_loss, 1),
        },
    ]
    recommended = min(options, key=lambda option: option["total_loss"])
    other = options[0] if recommended is options[1] else options[1]
    delta = round(other["total_loss"] - recommended["total_loss"], 1)

    weather_note = (
        "Rain risk is elevated. The demo adds a small slick-tyre exposure cost; it does not simulate a switch to intermediate or wet tyres."
        if rain_probability >= 35
        else "Rain risk is low in this scenario. Weather effects are simplified."
    )
    why = (
        f"{recommended['label']} has the lower estimated time loss by {delta:.1f} seconds under these assumptions."
        if delta >= 0.1
        else "The options are nearly tied under these assumptions; use the live race context to decide."
    )

    simulation = {
        "remaining_laps": remaining,
        "pit_now": simulation_timeline(
            current_lap,
            remaining,
            0,
            current_compound,
            tyre_age,
            next_compound,
            rain_probability,
            effective_pit_loss,
        ),
        "stay_out": simulation_timeline(
            current_lap,
            remaining,
            wait,
            current_compound,
            tyre_age,
            next_compound,
            rain_probability,
            effective_pit_loss,
        ),
    }

    return {
        "circuit": circuit["name"],
        "track": TRACK_SPECS[circuit_key],
        "scenario": {
            "current_lap": current_lap,
            "total_laps": total_laps,
            "current_compound": current_compound,
            "next_compound": next_compound,
            "tyre_age": tyre_age,
            "rain_probability": rain_probability,
            "safety_car": safety_car,
        },
        "recommendation": recommended["key"],
        "explanation": why,
        "options": options,
        "simulation": simulation,
        "weather_note": weather_note,
        "assumptions": {
            "model": "Illustrative rule-based estimate, not official telemetry or a trained strategy model",
            "wait_laps": wait,
            "safety_car_pit_factor": SAFETY_CAR_PIT_FACTOR if safety_car else 1.0,
            "circuit_pit_loss_is_user_adjustable": True,
        },
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "PitStrategistDemo/1.0"

    def send_bytes(self, status: int, content_type: str, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_bytes(status, "application/json; charset=utf-8", body)

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API name
        path = urlparse(self.path).path
        if path == "/api/health":
            self.send_json(200, {"ok": True, "service": "Zero Hour Pit Strategist API"})
            return

        assets = {
            "/": ("index.html", "text/html; charset=utf-8"),
            "/styles.css": ("styles.css", "text/css; charset=utf-8"),
            "/app.js": ("app.js", "text/javascript; charset=utf-8"),
        }
        if path not in assets:
            self.send_json(404, {"error": "Not found"})
            return
        filename, content_type = assets[path]
        try:
            self.send_bytes(200, content_type, (ROOT / filename).read_bytes())
        except OSError:
            self.send_json(500, {"error": "Website asset could not be loaded"})

    def do_POST(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API name
        if urlparse(self.path).path != "/api/strategy/compare":
            self.send_json(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 10_000:
                raise ValueError("Request body is empty or too large")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("Request must be a JSON object")
            self.send_json(200, compare_strategy(payload))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(400, {"error": "Request body must be valid JSON"})
        except ValueError as error:
            self.send_json(400, {"error": str(error)})

    def do_OPTIONS(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API name
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")


if __name__ == "__main__":
    print(f"Pit Strategist running at http://{HOST}:{PORT}")
    print("API health: http://127.0.0.1:8000/api/health")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
