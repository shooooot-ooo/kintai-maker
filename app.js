import { generateWorkbookInBrowser, readPdfMonth } from "./offline-generator.js?v=pwa4";

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
const pdfInput = document.querySelector("#pdf-file");
const pdfFileName = document.querySelector("#pdf-file-name");
const pdfMonth = document.querySelector("#pdf-month");
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

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
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

function setPdfMonth(message, tone = "") {
  if (!pdfMonth) return;
  pdfMonth.textContent = message;
  if (tone) {
    pdfMonth.dataset.tone = tone;
  } else {
    delete pdfMonth.dataset.tone;
  }
}

function formatMonth(value) {
  const [year, month] = String(value || "").split("-");
  if (!year || !month) return "";
  return `${year}年${Number(month)}月`;
}

function applySettings(settings) {
  for (const [key, input] of Object.entries(fields)) {
    input.value = settings[key] ?? defaults[key] ?? "";
  }
}

let pdfMonthRequestId = 0;

async function previewPdfMonth(file) {
  const requestId = (pdfMonthRequestId += 1);
  if (!file) {
    setPdfMonth("年月: 未選択");
    return;
  }

  setPdfMonth("年月: 読み取り中");
  try {
    const result = await readPdfMonth(file);
    if (requestId !== pdfMonthRequestId) return;
    setPdfMonth(`年月: ${formatMonth(result.month) || "読み取り済み"}`, "ok");
  } catch {
    if (requestId !== pdfMonthRequestId) return;
    setPdfMonth("年月: 読み取れません", "error");
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
    if (result.month) setPdfMonth(`年月: ${formatMonth(result.month)}`, "ok");
    setStatus(`${outputName} を作成しました。`, "ok");
  } catch (error) {
    setStatus(error.message || "勤務表の作成に失敗しました。", "error");
  } finally {
    submitButton.disabled = false;
  }
}

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
  pdfFileName.textContent = file ? file.name : "未選択";
  previewPdfMonth(file);
});

resetSchedule.addEventListener("click", () => {
  for (const key of ["plannedStart", "plannedEnd", "break1Start", "break1End", "break2Start", "break2End"]) {
    fields[key].value = defaults[key];
  }
  saveSettings();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
