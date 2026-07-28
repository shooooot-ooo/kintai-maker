const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const XML_NS = "http://www.w3.org/XML/1998/namespace";

const DAILY_COLUMNS = {
  workType: [55, 108],
  start: [155, 195],
  end: [195, 230],
  breakTime: [265, 305],
  overtime: [305, 342],
  actual: [342, 380],
  scheduledHoliday: [492, 532],
  legalHoliday: [532, 570],
  night: [570, 612],
  late: [612, 648],
  early: [648, 684],
};

const HOLIDAYS = {
  2025: [
    ["元日", "2025-01-01"],
    ["成人の日", "2025-01-13"],
    ["建国記念の日", "2025-02-11"],
    ["天皇誕生日", "2025-02-23"],
    ["振替休日", "2025-02-24"],
    ["春分の日", "2025-03-20"],
    ["昭和の日", "2025-04-29"],
    ["憲法記念日", "2025-05-03"],
    ["みどりの日", "2025-05-04"],
    ["こどもの日", "2025-05-05"],
    ["振替休日", "2025-05-06"],
    ["海の日", "2025-07-21"],
    ["山の日", "2025-08-11"],
    ["敬老の日", "2025-09-15"],
    ["秋分の日", "2025-09-23"],
    ["スポーツの日", "2025-10-13"],
    ["文化の日", "2025-11-03"],
    ["勤労感謝の日", "2025-11-23"],
    ["振替休日", "2025-11-24"],
  ],
  2026: [
    ["元日", "2026-01-01"],
    ["成人の日", "2026-01-12"],
    ["建国記念の日", "2026-02-11"],
    ["天皇誕生日", "2026-02-23"],
    ["春分の日", "2026-03-20"],
    ["昭和の日", "2026-04-29"],
    ["憲法記念日", "2026-05-03"],
    ["みどりの日", "2026-05-04"],
    ["こどもの日", "2026-05-05"],
    ["振替休日", "2026-05-06"],
    ["海の日", "2026-07-20"],
    ["山の日", "2026-08-11"],
    ["敬老の日", "2026-09-21"],
    ["国民の休日", "2026-09-22"],
    ["秋分の日", "2026-09-23"],
    ["スポーツの日", "2026-10-12"],
    ["文化の日", "2026-11-03"],
    ["勤労感謝の日", "2026-11-23"],
  ],
  2027: [
    ["元日", "2027-01-01"],
    ["成人の日", "2027-01-11"],
    ["建国記念の日", "2027-02-11"],
    ["天皇誕生日", "2027-02-23"],
    ["春分の日", "2027-03-21"],
    ["振替休日", "2027-03-22"],
    ["昭和の日", "2027-04-29"],
    ["憲法記念日", "2027-05-03"],
    ["みどりの日", "2027-05-04"],
    ["こどもの日", "2027-05-05"],
    ["海の日", "2027-07-19"],
    ["山の日", "2027-08-11"],
    ["敬老の日", "2027-09-20"],
    ["秋分の日", "2027-09-23"],
    ["スポーツの日", "2027-10-11"],
    ["文化の日", "2027-11-03"],
    ["勤労感謝の日", "2027-11-23"],
  ],
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let pdfjsPromise = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("/vendor/pdfjs/pdf.min.mjs").then((module) => {
      module.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
      return module;
    });
  }
  return pdfjsPromise;
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToXml(bytes) {
  return decoder.decode(bytes);
}

function xmlToBytes(value) {
  return encoder.encode(value);
}

function parseXml(value) {
  const doc = new DOMParser().parseFromString(value, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("Excelテンプレートの読み込みに失敗しました。");
  }
  return doc;
}

function serializeXml(doc) {
  return xmlToBytes(new XMLSerializer().serializeToString(doc));
}

function localName(element) {
  return element.localName || element.nodeName.split(":").pop();
}

function childrenByName(element, name) {
  return Array.from(element.children).filter((child) => localName(child) === name);
}

function firstByName(element, name) {
  return element.getElementsByTagNameNS(MAIN_NS, name)[0] || null;
}

function getAttr(element, name) {
  return element.getAttribute(name);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function safeFilenamePart(value) {
  return String(value || "氏名未取得").replace(/[\\/:*?"<>|\r\n\t]+/g, "").trim() || "氏名未取得";
}

function firstTime(value) {
  return String(value || "").match(/\d{1,3}:\d{2}/)?.[0] || "";
}

function timeToMinutes(value) {
  const match = String(value || "").match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function timeToHours(value, blankZero = false) {
  const minutes = timeToMinutes(value);
  if (minutes === 0 && blankZero) return "";
  return `${minutes / 60}`;
}

function excelTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes === 0) return "";
  return `${minutes / 1440}`;
}

function excelDateSerial(value) {
  const [year, month, day] = value.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const base = Date.UTC(1899, 11, 30);
  return `${Math.round((utc - base) / 86400000)}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function weekdayJp(date) {
  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
}

function plannedHours(settings) {
  let start = timeToMinutes(settings.plannedStart);
  let end = timeToMinutes(settings.plannedEnd);
  if (start === 0 && end === 0) return "";
  if (end <= start) end += 24 * 60;
  const break1 = Math.max(0, timeToMinutes(settings.break1End) - timeToMinutes(settings.break1Start));
  const break2 = Math.max(0, timeToMinutes(settings.break2End) - timeToMinutes(settings.break2Start));
  return `${Math.max(0, end - start - break1 - break2) / 60}`;
}

function colToIndex(column) {
  return [...column].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
}

function columnLetters(index) {
  let value = "";
  let current = index;
  while (current > 0) {
    current -= 1;
    value = String.fromCharCode(65 + (current % 26)) + value;
    current = Math.floor(current / 26);
  }
  return value;
}

function cellParts(address) {
  const match = address.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid cell address: ${address}`);
  return { row: Number(match[2]), col: colToIndex(match[1]) };
}

function getOrCreateRow(sheetDoc, rowIndex) {
  const sheetData = firstByName(sheetDoc, "sheetData");
  const rows = childrenByName(sheetData, "row");
  const existing = rows.find((row) => Number(row.getAttribute("r")) === rowIndex);
  if (existing) return existing;

  const row = sheetDoc.createElementNS(MAIN_NS, "row");
  row.setAttribute("r", `${rowIndex}`);
  const before = rows.find((current) => Number(current.getAttribute("r")) > rowIndex);
  sheetData.insertBefore(row, before || null);
  return row;
}

function getOrCreateCell(sheetDoc, address) {
  const { row: rowIndex, col } = cellParts(address);
  const row = getOrCreateRow(sheetDoc, rowIndex);
  const cells = childrenByName(row, "c");
  const existing = cells.find((cell) => cell.getAttribute("r") === address);
  if (existing) return existing;

  const cell = sheetDoc.createElementNS(MAIN_NS, "c");
  cell.setAttribute("r", address);
  const before = cells.find((current) => cellParts(current.getAttribute("r") || "A1").col > col);
  row.insertBefore(cell, before || null);
  return cell;
}

function clearCell(cell) {
  for (const child of Array.from(cell.children)) {
    if (["v", "is"].includes(localName(child))) child.remove();
  }
  cell.removeAttribute("t");
}

function setNumber(sheetDoc, address, value) {
  const cell = getOrCreateCell(sheetDoc, address);
  clearCell(cell);
  if (value === null || value === undefined || value === "") return;
  const node = sheetDoc.createElementNS(MAIN_NS, "v");
  node.textContent = `${value}`;
  cell.append(node);
}

function setText(sheetDoc, address, value) {
  const text = String(value || "");
  const cell = getOrCreateCell(sheetDoc, address);
  clearCell(cell);
  if (!text) return;
  cell.setAttribute("t", "inlineStr");
  const inline = sheetDoc.createElementNS(MAIN_NS, "is");
  const textNode = sheetDoc.createElementNS(MAIN_NS, "t");
  if (text !== text.trim() || text.includes("\n")) {
    textNode.setAttributeNS(XML_NS, "xml:space", "preserve");
  }
  textNode.textContent = text;
  inline.append(textNode);
  cell.append(inline);
}

function clearDailyInputs(sheetDoc) {
  const columns = [
    ...range(colToIndex("C"), colToIndex("H")),
    ...range(colToIndex("J"), colToIndex("O")),
    ...range(colToIndex("W"), colToIndex("AD")),
  ];
  for (let row = 11; row <= 41; row += 1) {
    for (const col of columns) {
      clearCell(getOrCreateCell(sheetDoc, `${columnLetters(col)}${row}`));
    }
  }
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function shouldWritePlanned(record) {
  if (["公休", "休日", "特休", "有休", "欠勤", "休職"].includes(record.workType)) return false;
  return Boolean(record.start || record.end || ["出勤", "残業"].includes(record.workType));
}

function writeDailyRecords(sheetDoc, records, settings) {
  const schedule = [
    settings.plannedStart,
    settings.plannedEnd,
    settings.break1Start,
    settings.break1End,
    settings.break2Start,
    settings.break2End,
  ];

  for (const record of records) {
    const row = record.day + 10;
    if (row < 11 || row > 41) continue;

    if (shouldWritePlanned(record)) {
      schedule.forEach((value, offset) => {
        setNumber(sheetDoc, `${columnLetters(colToIndex("C") + offset)}${row}`, excelTime(value));
      });
    }

    setNumber(sheetDoc, `J${row}`, excelTime(record.start));
    setNumber(sheetDoc, `K${row}`, excelTime(record.end));
    setNumber(sheetDoc, `L${row}`, excelTime(record.breakTime));
    if (record.note) setText(sheetDoc, `X${row}`, record.note);
  }
}

function writeVisibleFormulaCaches(sheetDoc, records, settings, year, month) {
  const byDay = new Map(records.map((record) => [record.day, record]));
  const maxDay = daysInMonth(year, month);
  const planned = plannedHours(settings);
  const totals = {
    planned: 0,
    actual: 0,
    overtime: 0,
    night: 0,
    lateEarly: 0,
    holiday: 0,
    attendance: 0,
  };

  for (let row = 11; row <= 41; row += 1) {
    const day = row - 10;
    if (day <= maxDay) {
      const current = new Date(year, month - 1, day);
      setNumber(sheetDoc, `A${row}`, excelDateSerial(`${year}-${pad2(month)}-${pad2(day)}`));
      setText(sheetDoc, `B${row}`, weekdayJp(current));
    } else {
      setNumber(sheetDoc, `A${row}`, "");
      setText(sheetDoc, `B${row}`, "");
    }

    const record = byDay.get(day);
    if (!record) continue;

    if (shouldWritePlanned(record) && planned) {
      setNumber(sheetDoc, `I${row}`, planned);
      totals.planned += Number(planned);
    } else {
      setNumber(sheetDoc, `I${row}`, "0");
    }

    const actual = timeToHours(record.actual);
    const overtime = timeToHours(record.overtime, true);
    const night = timeToHours(record.night, true);
    const lateEarlyMinutes = timeToMinutes(record.late) + timeToMinutes(record.early);
    const holidayMinutes = timeToMinutes(record.scheduledHoliday) + timeToMinutes(record.legalHoliday);

    setNumber(sheetDoc, `P${row}`, actual);
    if (lateEarlyMinutes === 0) setText(sheetDoc, `Q${row}`, "");
    else setNumber(sheetDoc, `Q${row}`, lateEarlyMinutes / 60);
    setText(sheetDoc, `R${row}`, "");
    setText(sheetDoc, `S${row}`, "");
    if (overtime) setNumber(sheetDoc, `T${row}`, overtime);
    else setText(sheetDoc, `T${row}`, "");
    if (night) setNumber(sheetDoc, `U${row}`, night);
    else setText(sheetDoc, `U${row}`, "");
    if (holidayMinutes === 0) setText(sheetDoc, `V${row}`, "");
    else setNumber(sheetDoc, `V${row}`, holidayMinutes / 60);

    const actualNumber = Number(actual || "0");
    totals.actual += actualNumber;
    totals.overtime += Number(overtime || "0");
    totals.night += Number(night || "0");
    totals.lateEarly += lateEarlyMinutes / 60;
    totals.holiday += holidayMinutes / 60;
    if (actualNumber > 0) totals.attendance += 1;
  }

  setNumber(sheetDoc, "I42", totals.planned);
  setNumber(sheetDoc, "P42", totals.actual);
  if (totals.lateEarly === 0) setText(sheetDoc, "Q42", "");
  else setNumber(sheetDoc, "Q42", totals.lateEarly);
  setText(sheetDoc, "R42", "");
  setText(sheetDoc, "S42", "");
  setNumber(sheetDoc, "T42", totals.overtime);
  setNumber(sheetDoc, "U42", totals.night);
  if (totals.holiday === 0) setText(sheetDoc, "V42", "");
  else setNumber(sheetDoc, "V42", totals.holiday);
  setText(sheetDoc, "W42", `出勤日数：${totals.attendance}日`);
}

function writeHolidays(sheetDoc, years) {
  const rows = [...new Set(years)]
    .sort((a, b) => a - b)
    .flatMap((year) => HOLIDAYS[year] || [])
    .sort((a, b) => a[1].localeCompare(b[1]));

  for (let row = 2; row < 110; row += 1) {
    clearCell(getOrCreateCell(sheetDoc, `A${row}`));
    clearCell(getOrCreateCell(sheetDoc, `B${row}`));
  }

  rows.slice(0, 108).forEach(([name, day], index) => {
    const row = index + 2;
    setText(sheetDoc, `A${row}`, name);
    setNumber(sheetDoc, `B${row}`, excelDateSerial(day));
  });
}

function quoteSheetReferences(sheetDoc) {
  for (const formula of Array.from(sheetDoc.getElementsByTagNameNS(MAIN_NS, "f"))) {
    formula.textContent = String(formula.textContent || "")
      .replaceAll("祝日リスト!", "'祝日リスト'!")
      .replaceAll("勤務表!", "'勤務表'!");
  }
}

function updateCalcSettings(workbookDoc) {
  let calcPr = firstByName(workbookDoc, "calcPr");
  if (!calcPr) {
    calcPr = workbookDoc.createElementNS(MAIN_NS, "calcPr");
    workbookDoc.documentElement.append(calcPr);
  }
  calcPr.setAttribute("calcMode", "auto");
  calcPr.setAttribute("fullCalcOnLoad", "1");
  calcPr.setAttribute("forceFullCalc", "1");
}

function resolveSheetPath(files, sheetName) {
  const workbookDoc = parseXml(bytesToXml(files.get("xl/workbook.xml")));
  const relsDoc = parseXml(bytesToXml(files.get("xl/_rels/workbook.xml.rels")));
  const relationships = new Map(
    Array.from(relsDoc.getElementsByTagNameNS(PKG_REL_NS, "Relationship")).map((rel) => [
      rel.getAttribute("Id"),
      rel.getAttribute("Target"),
    ]),
  );

  const sheet = Array.from(workbookDoc.getElementsByTagNameNS(MAIN_NS, "sheet")).find(
    (candidate) => candidate.getAttribute("name") === sheetName,
  );
  if (!sheet) throw new Error(`${sheetName} シートが見つかりません。`);
  const target = relationships.get(sheet.getAttributeNS(REL_NS, "id"));
  return `xl/${target.replace(/^\//, "")}`;
}

function removeCalcChainReferences(files) {
  files.delete("xl/calcChain.xml");

  const relsDoc = parseXml(bytesToXml(files.get("xl/_rels/workbook.xml.rels")));
  for (const rel of Array.from(relsDoc.getElementsByTagNameNS(PKG_REL_NS, "Relationship"))) {
    if (String(rel.getAttribute("Type") || "").endsWith("/calcChain")) rel.remove();
  }
  files.set("xl/_rels/workbook.xml.rels", serializeXml(relsDoc));

  const contentTypesDoc = parseXml(bytesToXml(files.get("[Content_Types].xml")));
  for (const override of Array.from(contentTypesDoc.getElementsByTagName("Override"))) {
    if (override.getAttribute("PartName") === "/xl/calcChain.xml") override.remove();
  }
  files.set("[Content_Types].xml", serializeXml(contentTypesDoc));
}

async function loadTemplateFiles() {
  const response = await fetch("/template.json");
  if (!response.ok) throw new Error("Excelテンプレートを読み込めませんでした。");
  const template = await response.json();
  return new Map(template.entries.map((entry) => [entry.name, base64ToBytes(entry.data)]));
}

function textInRange(items, [minX, maxX]) {
  return items
    .filter((item) => item.x >= minX && item.x < maxX)
    .sort((a, b) => a.x - b.x)
    .map((item) => item.str)
    .join("")
    .trim();
}

function timeInRange(items, range) {
  return firstTime(textInRange(items, range));
}

function normalizeNote(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

async function extractPdf(file) {
  const pdfjsLib = await getPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const items = textContent.items
    .map((item) => ({
      x: Math.round(item.transform[4]),
      y: Math.round(item.transform[5]),
      str: String(item.str || "").trim(),
    }))
    .filter((item) => item.str);

  const fullText = items.map((item) => item.str).join("");
  const monthMatch = fullText.replace(/\s+/g, "").match(/(20\d{2})年(\d{1,2})月度/);
  if (!monthMatch) throw new Error("PDFから年月を読み取れませんでした。");
  const month = `${monthMatch[1]}-${pad2(monthMatch[2])}`;

  const nameLabel = items.find((item) => item.str.includes("氏名"));
  const labelRow = nameLabel ? items.filter((item) => Math.abs(item.y - nameLabel.y) <= 2) : [];
  const nextLabelX = nameLabel
    ? labelRow.filter((item) => item.x > nameLabel.x + 30).sort((a, b) => a.x - b.x)[0]?.x ||
      nameLabel.x + 130
    : 0;
  const nameValueItems = nameLabel
    ? items.filter(
        (item) =>
          item.y < nameLabel.y &&
          item.y > nameLabel.y - 30 &&
          item.x >= nameLabel.x - 20 &&
          item.x < nextLabelX - 10,
      )
    : [];
  const employeeName =
    nameValueItems
      .sort((a, b) => a.x - b.x)
      .map((item) => item.str)
      .join("")
      .replace(/\s+/g, "") || "";
  if (!employeeName) throw new Error("PDFから氏名を読み取れませんでした。");

  const anchors = items
    .filter((item) => item.x >= 15 && item.x <= 30 && /^\d{2}$/.test(item.str))
    .sort((a, b) => b.y - a.y);
  const records = anchors.map((anchor, index) => {
    const sameLine = items.filter((item) => Math.abs(item.y - anchor.y) <= 2);
    const nextY = anchors[index + 1]?.y ?? -9999;
    const noteItems = items
      .filter((item) => item.x >= 685 && item.y <= anchor.y + 3 && item.y > nextY + 2)
      .sort((a, b) => (b.y - a.y) || (a.x - b.x));

    return {
      day: Number(anchor.str),
      workType: textInRange(sameLine, DAILY_COLUMNS.workType),
      start: timeInRange(sameLine, DAILY_COLUMNS.start),
      end: timeInRange(sameLine, DAILY_COLUMNS.end),
      breakTime: timeInRange(sameLine, DAILY_COLUMNS.breakTime),
      actual: timeInRange(sameLine, DAILY_COLUMNS.actual),
      overtime: timeInRange(sameLine, DAILY_COLUMNS.overtime),
      night: timeInRange(sameLine, DAILY_COLUMNS.night),
      late: timeInRange(sameLine, DAILY_COLUMNS.late),
      early: timeInRange(sameLine, DAILY_COLUMNS.early),
      scheduledHoliday: timeInRange(sameLine, DAILY_COLUMNS.scheduledHoliday),
      legalHoliday: timeInRange(sameLine, DAILY_COLUMNS.legalHoliday),
      note: normalizeNote(noteItems.map((item) => item.str).join("")),
    };
  });

  if (!records.length) throw new Error("PDFから日別の勤怠行を読み取れませんでした。");
  return { month, employeeName, days: records };
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function dosDateTime() {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  return { time, date };
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function zipStore(files) {
  const { time, date } = dosDateTime();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [name, data] of files.entries()) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, date);
    writeUint32(localView, 14, crc);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    local.set(nameBytes, 30);
    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, date);
    writeUint32(centralView, 16, crc);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length + data.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.size);
  writeUint16(endView, 10, files.size);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);

  return concatBytes([...localParts, centralDirectory, end]);
}

export async function generateWorkbookInBrowser(settings, pdfFile) {
  const [files, pdfData] = await Promise.all([loadTemplateFiles(), extractPdf(pdfFile)]);
  if (pdfData.month !== settings.targetMonth) {
    throw new Error("選択した年月とPDFの年月が違います。年月を確認してください。");
  }

  const [year, month] = settings.targetMonth.split("-").map(Number);
  const mainSheetPath = resolveSheetPath(files, "勤務表");
  const holidaySheetPath = resolveSheetPath(files, "祝日リスト");
  const mainSheetDoc = parseXml(bytesToXml(files.get(mainSheetPath)));
  const holidaySheetDoc = parseXml(bytesToXml(files.get(holidaySheetPath)));
  const workbookDoc = parseXml(bytesToXml(files.get("xl/workbook.xml")));

  setNumber(mainSheetDoc, "A3", year);
  setNumber(mainSheetDoc, "D3", month);
  setText(mainSheetDoc, "C5", settings.company || "");
  setText(mainSheetDoc, "L5", settings.project || "");
  setText(mainSheetDoc, "C6", pdfData.employeeName);
  setText(mainSheetDoc, "L6", settings.workStyle || "");

  clearDailyInputs(mainSheetDoc);
  writeDailyRecords(mainSheetDoc, pdfData.days, settings);
  writeVisibleFormulaCaches(mainSheetDoc, pdfData.days, settings, year, month);
  quoteSheetReferences(mainSheetDoc);
  writeHolidays(holidaySheetDoc, [year - 1, year, year + 1]);
  updateCalcSettings(workbookDoc);

  files.set(mainSheetPath, serializeXml(mainSheetDoc));
  files.set(holidaySheetPath, serializeXml(holidaySheetDoc));
  files.set("xl/workbook.xml", serializeXml(workbookDoc));

  for (const [name, data] of Array.from(files.entries())) {
    if (!name.startsWith("xl/worksheets/") || !name.endsWith(".xml")) continue;
    if (name === mainSheetPath || name === holidaySheetPath) continue;
    const doc = parseXml(bytesToXml(data));
    quoteSheetReferences(doc);
    files.set(name, serializeXml(doc));
  }

  removeCalcChainReferences(files);

  const workbook = zipStore(files);
  return {
    filename: `勤務表_${safeFilenamePart(pdfData.employeeName)}_${year}${pad2(month)}.xlsx`,
    blob: new Blob([workbook], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  };
}
