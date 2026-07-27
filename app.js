import { generateWorkbookInBrowser } from "/offline-generator.js?v=pwa1";

const STORAGE_KEY = "kintai-maker-settings-v1";
const HISTORY_KEY = "kintai-maker-history-v1";
const MAX_HISTORY_ITEMS = 8;

const defaults = {
  company: "",
  project: "",
  workStyle: "通常勤務",
  plannedStart: "10:00",
  plannedEnd: "19:00",
  break1Start: "12:00",
  break1End: "13:00",
  break2Start: "",
  break2End: "",
};

const form = document.querySelector("#kintai-form");
const monthSelect = document.querySelector("#target-month");
const pdfInput = document.querySelector("#pdf-file");
const pdfFileName = document.querySelector("#pdf-file-name");
const saveState = document.querySelector("#save-state");
const status = document.querySelector("#status");
const submitButton = document.querySelector("#submit-button");
const resetSchedule = document.querySelector("#reset-schedule");
const historyLists = {
  company: document.querySelector("#company-history"),
  project: document.querySelector("#project-history"),
};

const fields = {
  company: document.querySelector("#company"),
  project: document.querySelector("#project"),
  workStyle: document.querySelector("#work-style"),
  plannedStart: document.querySelector("#planned-start"),
  plannedEnd: document.querySelector("#planned-end"),
  break1Start: document.querySelector("#break1-start"),
  break1End: document.querySelector("#break1-end"),
  break2Start: document.querySelector("#break2-start"),
  break2End: document.querySelector("#break2-end"),
};

function pad2(value) {
  return String(value).padStart(2, "0");
}

function monthValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function defaultTargetMonth() {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return monthValue(date);
}

function buildMonthOptions() {
  const base = new Date();
  base.setDate(1);
  monthSelect.replaceChildren();

  for (let offset = 0; offset <= 12; offset += 1) {
    const date = new Date(base.getFullYear(), base.getMonth() - offset, 1);
    const value = monthValue(date);
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${date.getFullYear()}年${pad2(date.getMonth() + 1)}月`;
    monthSelect.append(option);
  }
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...defaults, targetMonth: defaultTargetMonth(), ...parsed };
  } catch {
    return { ...defaults, targetMonth: defaultTargetMonth() };
  }
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "{}");
    return {
      company: Array.isArray(parsed.company) ? parsed.company : [],
      project: Array.isArray(parsed.project) ? parsed.project : [],
    };
  } catch {
    return { company: [], project: [] };
  }
}

function collectSettings() {
  return {
    targetMonth: monthSelect.value,
    company: fields.company.value.trim(),
    project: fields.project.value.trim(),
    workStyle: fields.workStyle.value,
    plannedStart: fields.plannedStart.value,
    plannedEnd: fields.plannedEnd.value,
    break1Start: fields.break1Start.value,
    break1End: fields.break1End.value,
    break2Start: fields.break2Start.value,
    break2End: fields.break2End.value,
  };
}

function renderHistory(history) {
  for (const [key, list] of Object.entries(historyLists)) {
    if (!list) continue;
    list.replaceChildren();
    for (const value of history[key] || []) {
      const option = document.createElement("option");
      option.value = value;
      list.append(option);
    }
  }
}

function rememberHistory(settings) {
  const history = loadHistory();
  for (const key of Object.keys(historyLists)) {
    const value = String(settings[key] || "").trim();
    if (!value) continue;
    history[key] = [value, ...(history[key] || []).filter((item) => item !== value)].slice(0, MAX_HISTORY_ITEMS);
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory(history);
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collectSettings()));
  saveState.textContent = "設定を保存済み";
}

function setStatus(message, tone = "") {
  status.textContent = message;
  if (tone) {
    status.dataset.tone = tone;
  } else {
    delete status.dataset.tone;
  }
}

function applySettings(settings) {
  monthSelect.value = settings.targetMonth;
  if (!monthSelect.value) {
    monthSelect.value = defaultTargetMonth();
  }
  for (const [key, input] of Object.entries(fields)) {
    input.value = settings[key] ?? defaults[key] ?? "";
  }
}

async function submitForm(event) {
  event.preventDefault();
  const file = pdfInput.files?.[0];
  if (!file) {
    setStatus("PDFを選択してください。", "warn");
    return;
  }

  saveSettings();
  submitButton.disabled = true;
  setStatus("PDFを読み取って勤務表を作成しています。");

  try {
    const result = await generateWorkbookInBrowser(collectSettings(), file);
    const blob = result.blob;
    const outputName = result.filename || "勤務表.xlsx";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = outputName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    rememberHistory(collectSettings());
    setStatus(`${outputName} を作成しました。`, "ok");
  } catch (error) {
    setStatus(error.message || "勤務表の作成に失敗しました。", "error");
  } finally {
    submitButton.disabled = false;
  }
}

buildMonthOptions();
applySettings(loadSettings());
renderHistory(loadHistory());

form.addEventListener("input", () => {
  saveState.textContent = "設定を保存中";
  saveSettings();
});
form.addEventListener("change", saveSettings);
form.addEventListener("submit", submitForm);

pdfInput.addEventListener("change", () => {
  const file = pdfInput.files?.[0];
  pdfFileName.textContent = file ? file.name : "ファイルを選択";
});

resetSchedule.addEventListener("click", () => {
  for (const key of ["plannedStart", "plannedEnd", "break1Start", "break1End", "break2Start", "break2End"]) {
    fields[key].value = defaults[key];
  }
  saveSettings();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}
