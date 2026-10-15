const form = document.querySelector("#scenarioForm");
const API_BASE = window.location.port === "8000" ? "" : "http://127.0.0.1:8000";
let raceAnimationId = null;
let racePlaying = true;
const circuitSelect = document.querySelector("#circuit");
Array.from(circuitSelect.options).forEach((option) => {
  if (option.value !== "baku") option.remove();
});
circuitSelect.value = "baku";
const circuitNames = {
  baku: "BAKU CITY CIRCUIT",
  madring: "MADRING",
  monaco: "MONACO · MONTÉ CARLO",
  marina_bay: "MARINA BAY · SINGAPORE",
};

const setText = (selector, value) => {
  document.querySelector(selector).textContent = value;
};

document.querySelector("#circuit").addEventListener("change", (event) => {
  const values = { baku: 23, madring: 22.5, monaco: 24.5, marina_bay: 23.5 };
  document.querySelector("#pitLoss").value = values[event.target.value];
  setText("#heroCircuit", circuitNames[event.target.value]);
});

document.querySelector("#currentLap").addEventListener("input", (event) => {
  setText("#heroLap", `LAP ${event.target.value || "—"}`);
});

document.querySelector("#rainProbability").addEventListener("input", (event) => {
  setText("#rainValue", `${event.target.value}%`);
});

function makeCard(option, recommendation) {
  const card = document.createElement("article");
  card.className = `strategy-card${option.key === recommendation ? " best" : ""}`;
  const label = document.createElement("span");
  label.className = "card-label";
  label.textContent = option.label;
  if (option.key === recommendation) {
    const pill = document.createElement("span");
    pill.className = "best-pill";
    pill.textContent = "BEST ESTIMATE";
    label.append(" ", pill);
  }
  const value = document.createElement("strong");
  value.textContent = `${option.total_loss.toFixed(1)} sec`;
  const detail = document.createElement("span");
  detail.className = "card-detail";
  detail.textContent = `Pit lap ${option.pit_lap} · stop ${option.pit_loss.toFixed(1)}s · tyre ${option.tyre_loss.toFixed(1)}s · weather ${option.weather_adjustment.toFixed(1)}s`;
  card.append(label, value, detail);
  return card;
}

function trackPoint(progress) {
  const points = [[18, 18], [82, 18], [92, 28], [92, 72], [82, 82], [18, 82], [8, 72], [8, 28], [18, 18]];
  const scaled = ((progress % 1) + 1) % 1 * (points.length - 1);
  const index = Math.min(Math.floor(scaled), points.length - 2);
  const amount = scaled - index;
  return {
    x: points[index][0] + (points[index + 1][0] - points[index][0]) * amount,
    y: points[index][1] + (points[index + 1][1] - points[index][1]) * amount,
  };
}

function renderRaceReplay(result) {
  const simulation = result.simulation;
  const scenario = result.scenario;
  const track = result.track;
  const viewport = document.querySelector("#carBlips");
  const specs = document.querySelector("#trackSpecs");
  document.querySelector("#simTrackName").textContent = result.circuit;
  specs.replaceChildren(...[
    `${track.length_km.toFixed(3)} KM`,
    `${track.corners} CORNERS`,
    `${track.drs_zones} DRS ZONES`,
    track.character,
  ].map((text) => {
    const item = document.createElement("span");
    item.textContent = text;
    return item;
  }));

  if (raceAnimationId) cancelAnimationFrame(raceAnimationId);
  racePlaying = true;
  const toggle = document.querySelector("#simToggle");
  toggle.textContent = "PAUSE";
  const cars = [
    { key: "now", label: "NOW", color: "cyan", progress: 0.06 },
    { key: "stay", label: "ALT", color: "amber", progress: 0.34 },
    { key: "traffic-1", label: "P3", color: "white", progress: 0.52 },
    { key: "traffic-2", label: "P4", color: "white", progress: 0.70 },
    { key: "traffic-3", label: "P5", color: "white", progress: 0.86 },
  ];
  viewport.replaceChildren(...cars.map((car) => {
    const blip = document.createElement("div");
    blip.className = `car-blip ${car.color}`;
    blip.dataset.key = car.key;
    blip.innerHTML = `<span class="car-dot"></span><span class="car-label">${car.label}</span>`;
    viewport.append(blip);
    return blip;
  }));

  const start = performance.now();
  function frame(now) {
    const elapsedFrame = racePlaying ? Math.floor((now - start) / 650) : 0;
    const frameIndex = elapsedFrame % simulation.pit_now.length;
    const pitPoint = simulation.pit_now[frameIndex];
    const stayPoint = simulation.stay_out[frameIndex];
    const states = {
      now: { point: pitPoint, progress: (elapsedFrame / simulation.pit_now.length * 0.9 + 0.04) % 1 },
      stay: { point: stayPoint, progress: (elapsedFrame / simulation.stay_out.length * 0.82 + 0.32) % 1 },
      "traffic-1": { progress: (elapsedFrame / 28 + 0.52) % 1 },
      "traffic-2": { progress: (elapsedFrame / 32 + 0.70) % 1 },
      "traffic-3": { progress: (elapsedFrame / 38 + 0.86) % 1 },
    };
    cars.forEach((car) => {
      const state = states[car.key];
      const position = trackPoint(state.progress);
      const blip = viewport.querySelector(`[data-key="${car.key}"]`);
      blip.style.left = `${position.x}%`;
      blip.style.top = `${position.y}%`;
      const label = blip.querySelector(".car-label");
      if (state.point) label.textContent = `${car.label} · ${state.point.compound}`;
    });
    const lap = scenario.current_lap + frameIndex + 1;
    document.querySelector("#simLap").textContent = `LAP ${lap > scenario.total_laps ? scenario.current_lap + 1 : lap} / ${scenario.total_laps}`;
    const condition = scenario.safety_car ? "SAFETY CAR WINDOW" : scenario.rain_probability >= 35 ? "RAIN RISK" : "RACING";
    document.querySelector("#simCondition").textContent = condition;
    raceAnimationId = requestAnimationFrame(frame);
  }
  raceAnimationId = requestAnimationFrame(frame);
}

document.querySelector("#simToggle").addEventListener("click", () => {
  racePlaying = !racePlaying;
  document.querySelector("#simToggle").textContent = racePlaying ? "PAUSE" : "PLAY";
});

function renderSimulation(simulation) {
  const rows = document.querySelector("#simulationRows");
  const pitNow = simulation.pit_now;
  const stayOut = simulation.stay_out;
  const maxLoss = Math.max(
    ...pitNow.map((point) => point.cumulative_loss),
    ...stayOut.map((point) => point.cumulative_loss),
    1,
  );
  rows.replaceChildren(...pitNow.map((pitPoint, index) => {
    const stayPoint = stayOut[index];
    const row = document.createElement("div");
    row.className = "simulation-row";

    const label = document.createElement("span");
    label.className = "simulation-lap";
    label.textContent = `LAP ${pitPoint.lap}`;

    const lanes = document.createElement("div");
    lanes.className = "simulation-lanes";
    [
      { point: pitPoint, key: "now", label: "Pit now" },
      { point: stayPoint, key: "stay", label: "Stay out" },
    ].forEach(({ point, key, label: laneLabel }) => {
      const lane = document.createElement("div");
      lane.className = "simulation-lane";
      const laneName = document.createElement("span");
      laneName.className = "simulation-lane-name";
      laneName.textContent = laneLabel;
      const track = document.createElement("div");
      track.className = "simulation-track";
      const fill = document.createElement("div");
      fill.className = `simulation-fill ${key}${point.pit_stop ? " pit" : ""}`;
      fill.style.width = `${Math.max(3, point.cumulative_loss / maxLoss * 100)}%`;
      track.append(fill);
      const value = document.createElement("span");
      value.className = "simulation-value";
      value.textContent = `${point.cumulative_loss.toFixed(1)}s`;
      lane.append(laneName, track, value);
    });

    const detail = document.createElement("span");
    detail.className = "simulation-detail";
    detail.textContent = pitPoint.pit_stop || stayPoint.pit_stop ? "PIT" : "";
    row.append(label, lanes, detail);
    return row;
  }));
}

function renderResult(result) {
  const chosen = result.options.find((option) => option.key === result.recommendation);
  const other = result.options.find((option) => option.key !== result.recommendation);
  setText("#recommendationTitle", chosen.label);
  setText("#recommendationReason", result.explanation);
  setText("#deltaTag", `EDGE ${Math.abs(other.total_loss - chosen.total_loss).toFixed(1)} SEC`);
  setText("#weatherNote", result.weather_note);
  renderRaceReplay(result);
  renderSimulation(result.simulation);
  setText("#assumptionsText", `This rule-based comparison estimates tyre degradation for each stint and adds the editable pit-lane loss. When Safety Car is active, the demo scales pit loss by ${Math.round((1 - result.assumptions.safety_car_pit_factor) * 100)}%. It compares an immediate stop with waiting ${result.assumptions.wait_laps} laps. Values are estimates, not measured race outcomes.`);

  const cards = document.querySelector("#strategyCards");
  cards.replaceChildren(...result.options.map((option) => makeCard(option, result.recommendation)));

  const maxLoss = Math.max(...result.options.map((option) => option.total_loss), 1);
  const bars = document.querySelector("#bars");
  bars.replaceChildren(...result.options.map((option) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    const label = document.createElement("span");
    label.textContent = option.label;
    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = `bar-fill${option.key === result.recommendation ? " best" : ""}`;
    fill.style.width = `${Math.max(4, option.total_loss / maxLoss * 100)}%`;
    track.append(fill);
    const value = document.createElement("span");
    value.className = "bar-value";
    value.textContent = option.total_loss.toFixed(1);
    row.append(label, track, value);
    return row;
  }));

  document.querySelector("#emptyState").classList.add("hidden");
  document.querySelector("#resultContent").classList.remove("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.querySelector("#formError");
  const button = form.querySelector("button[type=submit]");
  const loading = document.querySelector("#loading");
  const content = document.querySelector("#resultContent");
  error.textContent = "";
  button.disabled = true;
  loading.classList.remove("hidden");
  content.classList.add("hidden");

  const payload = {
    circuit: document.querySelector("#circuit").value,
    current_lap: Number(document.querySelector("#currentLap").value),
    total_laps: Number(document.querySelector("#totalLaps").value),
    current_compound: document.querySelector("#currentCompound").value,
    tyre_age: Number(document.querySelector("#tyreAge").value),
    next_compound: document.querySelector("#nextCompound").value,
    pit_loss_seconds: Number(document.querySelector("#pitLoss").value),
    rain_probability: Number(document.querySelector("#rainProbability").value),
    safety_car: document.querySelector("#safetyCar").checked,
  };

  try {
    const response = await fetch(`${API_BASE}/api/strategy/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const responseText = await response.text();
    let result = null;
    if (responseText.trim()) {
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`Server returned invalid JSON (HTTP ${response.status})`);
      }
    }
    if (!response.ok) throw new Error(result?.error || `API request failed (HTTP ${response.status})`);
    if (!result || typeof result !== "object") throw new Error("Server returned an empty response");
    renderResult(result);
  } catch (requestError) {
    error.textContent = `Could not calculate: ${requestError.message}. Make sure server.py is running.`;
    document.querySelector("#emptyState").classList.remove("hidden");
  } finally {
    loading.classList.add("hidden");
    button.disabled = false;
  }
});

// Load an example comparison when the page opens so the demo is ready to show.
form.requestSubmit();
