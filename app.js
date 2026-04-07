const MAP_LAYOUT = [
  ["bedroom", "hallway", "art studio", "greenhouse"],
  ["living room", "kitchen", "bathroom", "outside"],
  ["workshop", "foundry", null, null],
];

const ROOM_LABELS = {
  bedroom: "Bedroom",
  hallway: "Hallway",
  "art studio": "Art Studio",
  greenhouse: "Greenhouse",
  "living room": "Living Room",
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  outside: "Outside",
  workshop: "Workshop",
  foundry: "Foundry",
};

const state = {
  log: null,
  stepIndex: 0,
};

const els = {
  file: document.getElementById("logFile"),
  taskName: document.getElementById("taskName"),
  modelName: document.getElementById("modelName"),
  finalScore: document.getElementById("finalScore"),
  stepCount: document.getElementById("stepCount"),
  finalPlace: document.getElementById("finalPlace"),
  finalAction: document.getElementById("finalAction"),
  finalAdjustedScore: document.getElementById("finalAdjustedScore"),
  stopReason: document.getElementById("stopReason"),
  judgeEmpty: document.getElementById("judgeEmpty"),
  judgePanel: document.getElementById("judgePanel"),
  judgeModel: document.getElementById("judgeModel"),
  judgeCompleted: document.getElementById("judgeCompleted"),
  judgeTableBody: document.getElementById("judgeTableBody"),
  judgeActionText: document.getElementById("judgeActionText"),
  judgeCompletionText: document.getElementById("judgeCompletionText"),
  judgeOverallText: document.getElementById("judgeOverallText"),
  judgeSummaryText: document.getElementById("judgeSummaryText"),
  mapGrid: document.getElementById("mapGrid"),
  locationLabel: document.getElementById("locationLabel"),
  stepLabel: document.getElementById("stepLabel"),
  stepSlider: document.getElementById("stepSlider"),
  prevStep: document.getElementById("prevStep"),
  nextStep: document.getElementById("nextStep"),
  chosenAction: document.getElementById("chosenAction"),
  rawOutput: document.getElementById("rawOutput"),
  rewardValue: document.getElementById("rewardValue"),
  scoreValue: document.getElementById("scoreValue"),
  cumulativeValue: document.getElementById("cumulativeValue"),
  fallbackValue: document.getElementById("fallbackValue"),
  observationText: document.getElementById("observationText"),
  timeline: document.getElementById("timeline"),
};

function inferLocation(entry) {
  return entry.current_place || entry.location_after || entry.location_before || "unknown";
}

function buildMap() {
  els.mapGrid.innerHTML = "";
  MAP_LAYOUT.flat().forEach((roomName) => {
    const card = document.createElement("div");
    card.className = roomName ? "room" : "room empty";

    if (roomName) {
      card.dataset.room = roomName;
      card.innerHTML = `
        <div class="room-name">${ROOM_LABELS[roomName] || roomName}</div>
        <div class="room-status">No agent here</div>
        <div class="room-action"></div>
      `;
    }

    els.mapGrid.appendChild(card);
  });
}

function updateMap(location, action) {
  const cards = els.mapGrid.querySelectorAll(".room");
  cards.forEach((card) => {
    if (!card.dataset.room) {
      return;
    }
    const active = card.dataset.room === location;
    card.classList.toggle("active", active);
    const status = card.querySelector(".room-status");
    const actionBox = card.querySelector(".room-action");
    status.textContent = active ? "Agent is here in this step" : "No agent here";
    if (actionBox) {
      actionBox.textContent = active ? `Action: ${action || "-"}` : "";
    }
  });
  els.locationLabel.textContent = `Current location: ${ROOM_LABELS[location] || location}`;
}

function renderTimeline(entries) {
  els.timeline.innerHTML = "";
  entries.forEach((entry, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "timeline-item";
    if (entry.failed_step) {
      item.classList.add("failure");
    }
    if ((entry.repeated_action_penalty ?? 0) < 0) {
      item.classList.add("repeated");
    }
    const badges = [];
    if ((entry.repeated_action_penalty ?? 0) < 0) {
      badges.push(`<span class="timeline-badge repeated">Repeated action penalty ${entry.repeated_action_penalty}</span>`);
    }
    item.innerHTML = `
      <strong>Step ${entry.step}</strong> - ${entry.chosen_action}
      <div class="meta">${ROOM_LABELS[inferLocation(entry)] || inferLocation(entry)} | reward ${entry.reward} | cumulative ${entry.cumulative_score ?? "-"}</div>
      <div class="meta">adjusted reward ${entry.adjusted_reward ?? "-"} | adjusted cumulative ${entry.adjusted_cumulative_score ?? "-"}</div>
      ${badges.length ? `<div class="badge-row">${badges.join("")}</div>` : ""}
    `;
    item.addEventListener("click", () => setStep(index));
    els.timeline.appendChild(item);
  });
}

function setStep(index) {
  if (!state.log) {
    return;
  }
  const entries = state.log.entries || [];
  if (!entries.length) {
    return;
  }

  state.stepIndex = Math.max(0, Math.min(index, entries.length - 1));
  const entry = entries[state.stepIndex];
  const location = inferLocation(entry);

  els.stepLabel.textContent = `Step ${entry.step}`;
  els.stepSlider.value = String(state.stepIndex);
  els.chosenAction.textContent = entry.chosen_action || "-";
  els.rawOutput.textContent = entry.raw_model_output || "-";
  els.rewardValue.textContent = String(entry.reward ?? "-");
  els.scoreValue.textContent = String(entry.score ?? "-");
  els.cumulativeValue.textContent = String(entry.cumulative_score ?? "-");
  els.fallbackValue.textContent = entry.used_fallback ? (entry.fallback_reason || "yes") : "no";
  els.observationText.textContent = entry.observation || "-";

  updateMap(location, entry.chosen_action);

  [...els.timeline.children].forEach((child, childIndex) => {
    child.classList.toggle("active", childIndex === state.stepIndex);
  });
}

function renderSummary(log) {
  els.taskName.textContent = log.task_name || "-";
  els.modelName.textContent = log.model || "-";
  els.finalScore.textContent = String(log.final_cumulative_score ?? "-");
  els.stepCount.textContent = String((log.entries || []).length);
  els.finalPlace.textContent = log.final_current_place || "-";
  els.finalAction.textContent = log.final_current_action || "-";
  els.finalAdjustedScore.textContent = String(log.final_adjusted_cumulative_score ?? "-");
  els.stopReason.textContent = log.stop_reason || "-";

  const stopMetric = els.stopReason.closest(".metric");
  if (stopMetric) {
    stopMetric.classList.toggle("alert", log.stopped_due_to_constant_failures === true);
  }
}

function renderJudge(log) {
  const judge = log.llm_judge;
  const evaluation = judge?.evaluation;
  if (!judge || !evaluation) {
    els.judgeEmpty.classList.remove("hidden");
    els.judgePanel.classList.add("hidden");
    els.judgeTableBody.innerHTML = "";
    return;
  }

  els.judgeEmpty.classList.add("hidden");
  els.judgePanel.classList.remove("hidden");
  els.judgeModel.textContent = judge.judge_model || "-";
  els.judgeCompleted.textContent = String(evaluation.completed_objective ?? "-");

  const rows = [
    ["Objective Completion", evaluation.objective_completion_score],
    ["Action Quality", evaluation.action_quality_score],
    ["Overall Performance", evaluation.overall_performance_score],
  ];

  els.judgeTableBody.innerHTML = rows.map(([label, score]) => {
    const numeric = Number(score ?? 0);
    const percent = Math.max(0, Math.min(100, numeric * 100));
    return `
      <tr>
        <td>${label}</td>
        <td>${numeric.toFixed(2)}</td>
        <td>
          <div class="score-bar">
            <div class="score-bar-fill" style="width:${percent}%"></div>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  els.judgeActionText.textContent = evaluation.action_quality_judgment || "-";
  els.judgeCompletionText.textContent = evaluation.completion_judgment || "-";
  els.judgeOverallText.textContent = evaluation.overall_judgment || "-";
  els.judgeSummaryText.textContent = evaluation.summary_paragraph || "-";
}

function loadLog(log) {
  state.log = log;
  renderSummary(log);
  renderJudge(log);
  renderTimeline(log.entries || []);
  els.stepSlider.max = String(Math.max((log.entries || []).length - 1, 0));
  setStep(0);
}

els.file.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  const log = JSON.parse(text);
  loadLog(log);
});

els.prevStep.addEventListener("click", () => setStep(state.stepIndex - 1));
els.nextStep.addEventListener("click", () => setStep(state.stepIndex + 1));
els.stepSlider.addEventListener("input", (event) => setStep(Number(event.target.value)));

buildMap();
