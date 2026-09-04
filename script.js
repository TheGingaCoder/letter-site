const STORAGE_KEY = "daily-rps-tracker-v1";
const UK_TIME_ZONE = "Europe/London";

const defaultState = {
  scores: { luke: 1, tyler: 1, draw: 0 },
  history: []
};

const entryView = document.getElementById("entryView");
const lockedView = document.getElementById("lockedView");
const dateChip = document.getElementById("dateChip");
const lukeScore = document.getElementById("lukeScore");
const tylerScore = document.getElementById("tylerScore");
const drawScore = document.getElementById("drawScore");
const lockedMessage = document.getElementById("lockedMessage");
const leadLine = document.getElementById("leadLine");
const historyList = document.getElementById("historyList");
const playedCount = document.getElementById("playedCount");
const yearProgress = document.getElementById("yearProgress");
const progressText = document.getElementById("progressText");
const skipButton = document.getElementById("skipButton");
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmText = document.getElementById("confirmText");
const cancelConfirm = document.getElementById("cancelConfirm");
const acceptConfirm = document.getElementById("acceptConfirm");

let state = loadState();
let pendingResult = null;

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !parsed.scores || !Array.isArray(parsed.history)) return structuredClone(defaultState);
    return parsed;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getUKDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return { year: values.year, month: values.month, day: values.day };
}

function getTodayKey() {
  const { year, month, day } = getUKDateParts();
  return `${year}-${month}-${day}`;
}

function formatToday() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date());
}

function formatHistoryDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function todaysEntry() {
  return state.history.find(item => item.date === getTodayKey());
}

function getResultLabel(result) {
  return {
    luke: "Luke won",
    tyler: "Tyler won",
    draw: "Draw",
    skip: "Day skipped"
  }[result];
}

function openConfirm(result) {
  pendingResult = result;
  const labels = {
    luke: ["Luke won today?", "This adds one win to Luke and locks today."],
    tyler: ["Tyler won today?", "This adds one win to Tyler and locks today."],
    draw: ["Record a draw?", "This adds one draw and locks today."],
    skip: ["Skip today?", "No score will change, but today will be locked as skipped."]
  };

  confirmTitle.textContent = labels[result][0];
  confirmText.textContent = labels[result][1];
  confirmModal.hidden = false;
}

function closeConfirm() {
  pendingResult = null;
  confirmModal.hidden = true;
}

function recordResult(result) {
  if (todaysEntry()) return;

  if (result === "luke") state.scores.luke += 1;
  if (result === "tyler") state.scores.tyler += 1;
  if (result === "draw") state.scores.draw += 1;

  state.history.unshift({
    date: getTodayKey(),
    result,
    recordedAt: new Date().toISOString()
  });

  saveState();
  closeConfirm();
  render();
}

function renderScoreboard() {
  lukeScore.textContent = state.scores.luke;
  tylerScore.textContent = state.scores.tyler;
  drawScore.textContent = state.scores.draw;

  const difference = Math.abs(state.scores.luke - state.scores.tyler);
  if (state.scores.luke === state.scores.tyler) {
    leadLine.textContent = "Luke and Tyler are tied.";
  } else if (state.scores.luke > state.scores.tyler) {
    leadLine.textContent = `Luke leads by ${difference}.`;
  } else {
    leadLine.textContent = `Tyler leads by ${difference}.`;
  }
}

function renderHistory() {
  const playedGames = state.scores.luke + state.scores.tyler + state.scores.draw;
  playedCount.textContent = playedGames;

  if (!state.history.length) {
    historyList.innerHTML = `<div class="empty-history">New daily results will appear here.</div>`;
  } else {
    historyList.innerHTML = state.history.slice(0, 12).map(item => `
      <div class="history-row">
        <span class="history-date">${formatHistoryDate(item.date)}</span>
        <span class="history-result ${item.result}">${getResultLabel(item.result)}</span>
      </div>
    `).join("");
  }

  const { year } = getUKDateParts();
  const start = Date.UTC(Number(year), 0, 1);
  const end = Date.UTC(Number(year) + 1, 0, 1);
  const todayParts = getUKDateParts();
  const current = Date.UTC(Number(todayParts.year), Number(todayParts.month) - 1, Number(todayParts.day));
  const dayNumber = Math.floor((current - start) / 86400000) + 1;
  const daysInYear = Math.round((end - start) / 86400000);
  const percentage = Math.min(100, (dayNumber / daysInYear) * 100);

  yearProgress.style.width = `${percentage}%`;
  progressText.textContent = `Day ${dayNumber} of ${daysInYear} • ${state.history.length} daily ${state.history.length === 1 ? "entry" : "entries"} recorded on this device.`;
}

function render() {
  dateChip.textContent = formatToday();
  const today = todaysEntry();

  if (today) {
    entryView.hidden = true;
    lockedView.hidden = false;
    lockedMessage.textContent = today.result === "skip"
      ? "No game recorded today"
      : `${getResultLabel(today.result)} today`;
  } else {
    entryView.hidden = false;
    lockedView.hidden = true;
  }

  renderScoreboard();
  renderHistory();
}

document.querySelectorAll("[data-result]").forEach(button => {
  button.addEventListener("click", () => openConfirm(button.dataset.result));
});

skipButton.addEventListener("click", () => openConfirm("skip"));
cancelConfirm.addEventListener("click", closeConfirm);
acceptConfirm.addEventListener("click", () => pendingResult && recordResult(pendingResult));
confirmModal.addEventListener("click", event => {
  if (event.target === confirmModal) closeConfirm();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !confirmModal.hidden) closeConfirm();
});

render();
