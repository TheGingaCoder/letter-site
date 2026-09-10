const STORAGE_KEY = "daily-rps-tracker-v2";
const UK_TIME_ZONE = "Europe/London";
const DATA_FILE = "scores.json";
const PLAYABLE_DAYS = new Set([1, 4, 5]); // Monday, Thursday, Friday (UTC weekday numbers)

const defaultState = {
  scores: { luke: 1, tyler: 1, draw: 0 },
  history: []
};

const lukeScore = document.getElementById("lukeScore");
const tylerScore = document.getElementById("tylerScore");
const drawScore = document.getElementById("drawScore");
const leadLine = document.getElementById("leadLine");
const monthTitle = document.getElementById("monthTitle");
const calendarGrid = document.getElementById("calendarGrid");
const prevMonth = document.getElementById("prevMonth");
const nextMonth = document.getElementById("nextMonth");
const todayCheck = document.getElementById("todayCheck");
const todayStatus = document.getElementById("todayStatus");
const todayStatusText = document.getElementById("todayStatusText");
const editTodayButton = document.getElementById("editTodayButton");

const dayModal = document.getElementById("dayModal");
const dayModalTitle = document.getElementById("dayModalTitle");
const dayModalDate = document.getElementById("dayModalDate");
const clearDayButton = document.getElementById("clearDayButton");
const closeDayModal = document.getElementById("closeDayModal");

const editScoreButton = document.getElementById("editScoreButton");
const scoreModal = document.getElementById("scoreModal");
const editLuke = document.getElementById("editLuke");
const editTyler = document.getElementById("editTyler");
const editDraw = document.getElementById("editDraw");
const cancelScoreEdit = document.getElementById("cancelScoreEdit");
const saveScoreEdit = document.getElementById("saveScoreEdit");

let state = cloneDefaultState();
let selectedDateKey = null;
let initialised = false;

const todayParts = getUKDateParts();
let visibleYear = Number(todayParts.year);
let visibleMonth = Number(todayParts.month) - 1;

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(defaultState));
}

function toSafeScore(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function normaliseState(raw) {
  if (!raw || !raw.scores || !Array.isArray(raw.history)) return cloneDefaultState();
  return {
    scores: {
      luke: toSafeScore(raw.scores.luke, 1),
      tyler: toSafeScore(raw.scores.tyler, 1),
      draw: toSafeScore(raw.scores.draw, 0)
    },
    history: raw.history.filter(item => item && item.date && item.result)
  };
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normaliseState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function loadGithubSeed() {
  try {
    const response = await fetch(`${DATA_FILE}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Data file unavailable");
    return normaliseState(await response.json());
  } catch {
    return cloneDefaultState();
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
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return { year: values.year, month: values.month, day: values.day };
}

function getTodayKey() {
  const { year, month, day } = getUKDateParts();
  return `${year}-${month}-${day}`;
}

function makeDateKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateKeyToUTC(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function isPlayableKey(dateKey) {
  return PLAYABLE_DAYS.has(dateKeyToUTC(dateKey).getUTCDay());
}

function isFutureKey(dateKey) {
  return dateKey > getTodayKey();
}

function isEditableKey(dateKey) {
  return !isFutureKey(dateKey) && isPlayableKey(dateKey);
}

function formatDateKey(dateKey) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(dateKeyToUTC(dateKey));
}

function getEntry(dateKey) {
  return state.history.find(item => item.date === dateKey) || null;
}

function resultLabel(result) {
  return {
    luke: "Luke won",
    tyler: "Tyler won",
    draw: "Draw",
    skip: "Skipped"
  }[result] || "";
}

function adjustScoreForResult(result, amount) {
  if (result === "luke") state.scores.luke = Math.max(0, state.scores.luke + amount);
  if (result === "tyler") state.scores.tyler = Math.max(0, state.scores.tyler + amount);
  if (result === "draw") state.scores.draw = Math.max(0, state.scores.draw + amount);
}

function animateScore(result) {
  const map = { luke: lukeScore, tyler: tylerScore, draw: drawScore };
  const element = map[result];
  if (!element) return;
  element.classList.remove("score-pop");
  void element.offsetWidth;
  element.classList.add("score-pop");
}

function burstFromElement(element) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const burst = document.createElement("span");
  burst.className = "tap-burst";
  burst.style.left = `${rect.left + rect.width / 2}px`;
  burst.style.top = `${rect.top + rect.height / 2}px`;
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 700);
}

function setDayResult(dateKey, newResult, sourceElement = null) {
  if (!isEditableKey(dateKey)) return;

  const existingIndex = state.history.findIndex(item => item.date === dateKey);
  const existing = existingIndex >= 0 ? state.history[existingIndex] : null;

  if (existing) adjustScoreForResult(existing.result, -1);

  if (newResult) {
    adjustScoreForResult(newResult, 1);
    const record = {
      date: dateKey,
      result: newResult,
      recordedAt: new Date().toISOString()
    };
    if (existingIndex >= 0) state.history[existingIndex] = record;
    else state.history.push(record);
  } else if (existingIndex >= 0) {
    state.history.splice(existingIndex, 1);
  }

  state.history.sort((a, b) => b.date.localeCompare(a.date));
  saveState();
  closeDayEditor();
  if (newResult) animateScore(newResult);
  burstFromElement(sourceElement);
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

function renderTodayCheck() {
  const todayKey = getTodayKey();
  const playable = isPlayableKey(todayKey);
  const entry = getEntry(todayKey);

  todayCheck.hidden = !playable || Boolean(entry);
  todayStatus.hidden = playable && !entry;

  if (!playable) {
    todayStatusText.textContent = "No game scheduled today.";
    editTodayButton.hidden = true;
  } else if (entry) {
    todayStatusText.textContent = `Today: ${resultLabel(entry.result)}`;
    editTodayButton.hidden = false;
  }
}

function renderCalendar() {
  const monthDate = new Date(Date.UTC(visibleYear, visibleMonth, 1, 12));
  monthTitle.textContent = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric"
  }).format(monthDate);

  const firstDaySundayBased = new Date(Date.UTC(visibleYear, visibleMonth, 1)).getUTCDay();
  const leadingBlankDays = (firstDaySundayBased + 6) % 7;
  const daysInMonth = new Date(Date.UTC(visibleYear, visibleMonth + 1, 0)).getUTCDate();
  const todayKey = getTodayKey();

  const cells = [];
  for (let i = 0; i < leadingBlankDays; i += 1) {
    cells.push('<div class="calendar-day empty" aria-hidden="true"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = makeDateKey(visibleYear, visibleMonth, day);
    const entry = getEntry(dateKey);
    const future = isFutureKey(dateKey);
    const playable = isPlayableKey(dateKey);
    const disabled = future || !playable;
    const classes = ["calendar-day"];
    if (entry) classes.push(entry.result);
    if (future) classes.push("future");
    if (!playable) classes.push("closed-day");
    if (dateKey === todayKey) classes.push("today");

    const reason = future ? "future date" : (!playable ? "not a playing day" : "");
    cells.push(`
      <button class="${classes.join(" ")}" type="button" data-date="${dateKey}" ${disabled ? "disabled" : ""} aria-label="${formatDateKey(dateKey)}${entry ? `, ${resultLabel(entry.result)}` : reason ? `, ${reason}` : ""}">
        <span class="day-number">${day}</span>
        ${entry ? `<span class="day-result">${resultLabel(entry.result)}</span>` : !playable ? `<span class="day-result closed-label">Off</span>` : ""}
      </button>
    `);
  }

  calendarGrid.innerHTML = cells.join("");

  const currentMonthKey = `${todayParts.year}-${todayParts.month}`;
  const visibleMonthKey = `${visibleYear}-${String(visibleMonth + 1).padStart(2, "0")}`;
  nextMonth.disabled = visibleMonthKey >= currentMonthKey;
}

function openDayEditor(dateKey) {
  if (!isEditableKey(dateKey)) return;
  selectedDateKey = dateKey;
  const entry = getEntry(dateKey);
  dayModalTitle.textContent = entry ? "Change result" : "Choose a result";
  dayModalDate.textContent = formatDateKey(dateKey);
  clearDayButton.disabled = !entry;
  dayModal.hidden = false;
}

function closeDayEditor() {
  selectedDateKey = null;
  dayModal.hidden = true;
}

function openScoreEditor() {
  editLuke.value = state.scores.luke;
  editTyler.value = state.scores.tyler;
  editDraw.value = state.scores.draw;
  scoreModal.hidden = false;
}

function closeScoreEditor() {
  scoreModal.hidden = true;
}

function saveScoreOverride() {
  state.scores = {
    luke: toSafeScore(editLuke.value, state.scores.luke),
    tyler: toSafeScore(editTyler.value, state.scores.tyler),
    draw: toSafeScore(editDraw.value, state.scores.draw)
  };
  saveState();
  closeScoreEditor();
  render();
}

function render() {
  renderScoreboard();
  renderTodayCheck();
  renderCalendar();
}

async function initialise() {
  if (initialised) return;
  initialised = true;
  const local = loadLocalState();
  state = local || await loadGithubSeed();
  saveState();
  render();
}

prevMonth.addEventListener("click", () => {
  visibleMonth -= 1;
  if (visibleMonth < 0) {
    visibleMonth = 11;
    visibleYear -= 1;
  }
  renderCalendar();
});

nextMonth.addEventListener("click", () => {
  const currentYear = Number(todayParts.year);
  const currentMonth = Number(todayParts.month) - 1;
  if (visibleYear > currentYear || (visibleYear === currentYear && visibleMonth >= currentMonth)) return;
  visibleMonth += 1;
  if (visibleMonth > 11) {
    visibleMonth = 0;
    visibleYear += 1;
  }
  renderCalendar();
});

calendarGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-date]");
  if (!button || button.disabled) return;
  openDayEditor(button.dataset.date);
});

document.querySelectorAll("[data-day-result]").forEach(button => {
  button.addEventListener("click", () => {
    if (selectedDateKey) setDayResult(selectedDateKey, button.dataset.dayResult, button);
  });
});

document.querySelectorAll("[data-today-result]").forEach(button => {
  button.addEventListener("click", () => setDayResult(getTodayKey(), button.dataset.todayResult, button));
});

clearDayButton.addEventListener("click", () => {
  if (selectedDateKey) setDayResult(selectedDateKey, null, clearDayButton);
});
closeDayModal.addEventListener("click", closeDayEditor);
dayModal.addEventListener("click", event => {
  if (event.target === dayModal) closeDayEditor();
});

editTodayButton.addEventListener("click", () => openDayEditor(getTodayKey()));
editScoreButton.addEventListener("click", openScoreEditor);
cancelScoreEdit.addEventListener("click", closeScoreEditor);
saveScoreEdit.addEventListener("click", saveScoreOverride);
scoreModal.addEventListener("click", event => {
  if (event.target === scoreModal) closeScoreEditor();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (!dayModal.hidden) closeDayEditor();
    if (!scoreModal.hidden) closeScoreEditor();
  }
});

initialise();