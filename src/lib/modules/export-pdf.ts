/**
 * PDF renderer for a workspace export.
 *
 * Layout is card-based rather than tabular: a 19-column PM record cannot be
 * read out of an A4 table, so each record gets its own block — header band
 * with id/title/status chips, a two-column field grid for short values, and
 * full-width prose blocks for long ones. Cover + per-module opener pages give
 * the document a document-like structure instead of a data dump.
 */
import PDFDocument from "pdfkit";
import { EMPTY_VALUE, type ExportBundle, type ExportColumn, type ExportSection } from "./export";

type Doc = PDFKit.PDFDocument;

const PAGE = { width: 595.28, height: 841.89 };
const M = { left: 48, right: 48, top: 58, bottom: 58 };
const CONTENT_W = PAGE.width - M.left - M.right;
const BOTTOM_Y = PAGE.height - M.bottom;

const INK = "#101219";
const BODY = "#2c303c";
const MUTED = "#666c7e";
const FAINT = "#a2a7b4";
const ACCENT = "#5b76fe";
const ACCENT_DEEP = "#3a4fb8";
const RULE = "#e4e6ec";
const HAIR = "#eef0f4";
const CARD_BG = "#f7f8fb";
const WHITE = "#ffffff";

/** Semantic colours for status-ish chip values. Order matters — first match wins. */
const CHIP_TONES: { test: RegExp; fg: string; bg: string }[] = [
  { test: /^(done|closed|resolved|released|completed|approved|adopted|stable|verified)$/i, fg: "#1a7f4b", bg: "#e6f6ed" },
  { test: /^(critical|blocked|missed|rejected|rolled back|won't fix|deprecated)$/i, fg: "#b3261e", bg: "#fdeceb" },
  { test: /^(high|open|needs revision|at risk)$/i, fg: "#a1571a", bg: "#fdf1e3" },
  { test: /^(in progress|active|mitigating|in review|testing|review|under review|evaluating)$/i, fg: "#2a54c4", bg: "#e9edfe" },
  { test: /^(low|draft|planned|proposed|upcoming|new|todo|none|archived)$/i, fg: "#5c6273", bg: "#eff0f4" },
];

function chipTone(value: string): { fg: string; bg: string } {
  for (const t of CHIP_TONES) if (t.test.test(value.trim())) return { fg: t.fg, bg: t.bg };
  return { fg: ACCENT_DEEP, bg: "#edf0fe" };
}

/* ------------------------------------------------------------------ utils */

function ensure(doc: Doc, needed: number): boolean {
  if (doc.y + needed <= BOTTOM_Y) return false;
  doc.addPage();
  doc.y = M.top;
  return true;
}

function remaining(doc: Doc): number {
  return BOTTOM_Y - doc.y;
}

function truncate(doc: Doc, text: string, width: number): string {
  if (doc.widthOfString(text) <= width) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (doc.widthOfString(`${text.slice(0, mid)}…`) <= width) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}

function label(doc: Doc, text: string, x: number, y: number, width: number) {
  doc.font("Helvetica-Bold").fontSize(6.6).fillColor(FAINT)
    .text(truncate(doc, text.toUpperCase(), width), x, y, { width, lineBreak: false, characterSpacing: 0.6 });
}

function hairline(doc: Doc, y: number, color = HAIR, width = CONTENT_W, x = M.left) {
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(0.6).strokeColor(color).stroke();
}

/** Draw a pill; returns its width. Pass `measureOnly` to size without painting. */
function chip(doc: Doc, text: string, x: number, y: number, opts?: { measureOnly?: boolean; tone?: { fg: string; bg: string } }) {
  doc.font("Helvetica-Bold").fontSize(7.4);
  const w = doc.widthOfString(text) + 14;
  if (!opts?.measureOnly) {
    const tone = opts?.tone ?? chipTone(text);
    doc.roundedRect(x, y, w, 14, 7).fill(tone.bg);
    doc.fillColor(tone.fg).text(text, x + 7, y + 3.8, { lineBreak: false });
  }
  return w;
}

/* ------------------------------------------------------- record card parts */

/** Fields shown as chips in the card header: status-like selects, kept short. */
function chipFields(section: ExportSection): ExportColumn[] {
  return section.columns.filter(
    (c) => c.type === "select" && c.key !== section.titleKey
  );
}

/** Short fields that land in the two-column grid (everything not chip/title/long/meta). */
function gridFields(section: ExportSection): ExportColumn[] {
  const chips = new Set(chipFields(section).map((c) => c.key));
  return section.columns.filter(
    (c) => !c.long && !chips.has(c.key) && c.key !== section.titleKey && c.key !== "id"
      && c.key !== "createdBy" && c.key !== "createdAt" && c.key !== "updatedAt"
  );
}

const GRID_GAP = 18;
const GRID_COL_W = (CONTENT_W - 28 - GRID_GAP) / 2;

/** Header band: accent bar, id, title, status chips. Returns its height. */
function drawCardHeader(doc: Doc, section: ExportSection, row: Record<string, string>, measureOnly = false): number {
  const padX = 14;
  const innerW = CONTENT_W - padX * 2;

  doc.font("Helvetica-Bold").fontSize(11.5);
  const idText = row.id ?? "";
  const idW = doc.font("Helvetica-Bold").fontSize(8.5).widthOfString(idText) + 12;
  const titleText = row[section.titleKey] === EMPTY_VALUE ? "Untitled" : row[section.titleKey];
  const titleW = innerW - idW - 8;
  doc.font("Helvetica-Bold").fontSize(11.5);
  const titleH = doc.heightOfString(titleText, { width: titleW });

  // Chips wrap onto as many rows as they need.
  const chips = chipFields(section)
    .map((c) => ({ col: c, value: row[c.key] }))
    .filter((c) => c.value && c.value !== EMPTY_VALUE);
  const chipRows: { text: string; w: number }[][] = [];
  let line: { text: string; w: number }[] = [];
  let lineW = 0;
  for (const c of chips) {
    const text = `${c.col.label}: ${c.value}`;
    const w = chip(doc, text, 0, 0, { measureOnly: true }) + 6;
    if (lineW + w > innerW && line.length) {
      chipRows.push(line);
      line = [];
      lineW = 0;
    }
    line.push({ text, w });
    lineW += w;
  }
  if (line.length) chipRows.push(line);

  const chipsH = chipRows.length ? chipRows.length * 19 + 3 : 0;
  const height = 12 + Math.max(titleH, 14) + chipsH + 11;
  if (measureOnly) return height;

  const y = doc.y;
  doc.roundedRect(M.left, y, CONTENT_W, height, 5).fill(CARD_BG);
  doc.rect(M.left, y + 5, 2.5, height - 10).fill(ACCENT);

  // ID pill.
  doc.roundedRect(M.left + padX, y + 12, idW, 14, 3).fill(WHITE);
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED)
    .text(idText, M.left + padX, y + 15.6, { width: idW, align: "center", lineBreak: false });

  doc.font("Helvetica-Bold").fontSize(11.5).fillColor(INK)
    .text(titleText, M.left + padX + idW + 8, y + 12, { width: titleW });

  let cy = y + 12 + Math.max(titleH, 14) + 3;
  for (const r of chipRows) {
    let cx = M.left + padX;
    for (const c of r) {
      chip(doc, c.text, cx, cy);
      cx += c.w;
    }
    cy += 19;
  }

  doc.y = y + height;
  return height;
}

/** Two-column label/value grid. Returns height when measuring. */
function drawGrid(doc: Doc, cols: ExportColumn[], row: Record<string, string>, measureOnly = false): number {
  if (cols.length === 0) return 0;

  const cells = cols.map((c) => {
    const value = row[c.key] ?? EMPTY_VALUE;
    doc.font("Helvetica").fontSize(8.6);
    const h = doc.heightOfString(value, { width: GRID_COL_W });
    return { col: c, value, h: Math.max(h, 10) };
  });

  // Pair cells into rows; both cells in a row share the taller height.
  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
  const rowHeights = rows.map((r) => Math.max(...r.map((c) => c.h)) + 9 + 8);

  if (measureOnly) return rowHeights.reduce((a, b) => a + b, 0) + 8;

  doc.y += 8;
  rows.forEach((r, ri) => {
    // A grid row is small enough to never justify splitting.
    if (ensure(doc, rowHeights[ri])) doc.y += 2;
    const y = doc.y;
    r.forEach((cell, ci) => {
      const x = M.left + 14 + ci * (GRID_COL_W + GRID_GAP);
      label(doc, cell.col.label, x, y, GRID_COL_W);
      const empty = cell.value === EMPTY_VALUE;
      doc.font(empty ? "Helvetica-Oblique" : "Helvetica").fontSize(8.6)
        .fillColor(empty ? FAINT : BODY)
        .text(cell.value, x, y + 9, { width: GRID_COL_W });
    });
    doc.y = y + rowHeights[ri];
  });
  return 0;
}

/** Long prose fields, each with a label and a left rule. Flows across pages. */
function drawLongFields(doc: Doc, cols: ExportColumn[], row: Record<string, string>) {
  for (const c of cols) {
    const value = row[c.key] ?? EMPTY_VALUE;
    const empty = value === EMPTY_VALUE;
    const textW = CONTENT_W - 28;

    doc.font(empty ? "Helvetica-Oblique" : "Helvetica").fontSize(8.8);
    const h = doc.heightOfString(value, { width: textW, lineGap: 1.4 });

    // Keep the label with at least the first lines of its value.
    if (remaining(doc) < Math.min(h, 34) + 20) {
      doc.addPage();
      doc.y = M.top;
    }

    doc.y += 9;
    const startY = doc.y;
    label(doc, c.label, M.left + 14, startY, textW);
    doc.font(empty ? "Helvetica-Oblique" : "Helvetica").fontSize(8.8)
      .fillColor(empty ? FAINT : BODY)
      .text(value, M.left + 14, startY + 10, { width: textW, lineGap: 1.4 });
    const endY = doc.y;

    // Rule only when the block stayed on one page — pdfkit paginates the text
    // itself, and a rule drawn after the fact would land on the wrong page.
    if (endY > startY) {
      doc.moveTo(M.left + 5, startY + 1).lineTo(M.left + 5, endY).lineWidth(1.4).strokeColor(RULE).stroke();
    }
    doc.y = endY + 2;
  }
}

function drawCardFooter(doc: Doc, row: Record<string, string>) {
  ensure(doc, 22);
  doc.y += 8;
  const parts = [
    `Created by ${row.createdBy}`,
    `Created ${row.createdAt}`,
    `Updated ${row.updatedAt}`,
  ].filter((p) => !p.includes(EMPTY_VALUE));
  doc.font("Helvetica").fontSize(7.2).fillColor(FAINT)
    .text(parts.join("   ·   "), M.left + 14, doc.y, { width: CONTENT_W - 28, lineBreak: false });
  doc.y += 12;
  hairline(doc, doc.y);
  doc.y += 14;
}

function drawRecord(doc: Doc, section: ExportSection, row: Record<string, string>) {
  const grid = gridFields(section);
  const longs = section.columns.filter((c) => c.long);

  // Keep the header with at least the start of the body: if the header plus a
  // slice of the grid cannot fit, start the record on a fresh page.
  const headerH = drawCardHeader(doc, section, row, true);
  const gridH = drawGrid(doc, grid, row, true);
  const wanted = headerH + Math.min(gridH, 56) + 20;
  if (remaining(doc) < wanted) {
    doc.addPage();
    doc.y = M.top;
  }

  drawCardHeader(doc, section, row);
  drawGrid(doc, grid, row);
  drawLongFields(doc, longs, row);
  drawCardFooter(doc, row);
}

/* ---------------------------------------------------------------- section */

function drawStatusBar(doc: Doc, section: ExportSection) {
  const total = section.rows.length;
  if (!section.statusBreakdown.length || total === 0) return;

  const y = doc.y;
  const barH = 9;
  let x = M.left;
  section.statusBreakdown.forEach((s, i) => {
    const w = Math.max((s.count / total) * CONTENT_W, 3);
    const tone = chipTone(s.value);
    const isFirst = i === 0;
    const isLast = i === section.statusBreakdown.length - 1;
    // Round only the outer ends so the bar reads as one track.
    if (isFirst || isLast) {
      doc.roundedRect(x, y, w, barH, 4.5).fill(tone.fg);
      if (!isFirst) doc.rect(x, y, Math.min(w, 5), barH).fill(tone.fg);
      if (!isLast) doc.rect(x + w - Math.min(w, 5), y, Math.min(w, 5), barH).fill(tone.fg);
    } else {
      doc.rect(x, y, w, barH).fill(tone.fg);
    }
    x += w;
  });
  doc.y = y + barH + 10;

  // Legend.
  let lx = M.left;
  let ly = doc.y;
  for (const s of section.statusBreakdown) {
    const text = `${s.value} — ${s.count}`;
    doc.font("Helvetica").fontSize(7.6);
    const w = doc.widthOfString(text) + 16;
    if (lx + w > M.left + CONTENT_W) {
      lx = M.left;
      ly += 14;
    }
    const tone = chipTone(s.value);
    doc.circle(lx + 3, ly + 4, 3).fill(tone.fg);
    doc.font("Helvetica").fontSize(7.6).fillColor(MUTED).text(text, lx + 10, ly + 1, { lineBreak: false });
    lx += w;
  }
  doc.y = ly + 18;
}

/** Returns the page index the section opens on, for the contents page. */
function drawSection(doc: Doc, section: ExportSection, index: number): number {
  doc.addPage();
  doc.y = M.top;
  const pageIndex = doc.bufferedPageRange().count - 1;

  // Opener.
  doc.font("Helvetica-Bold").fontSize(8).fillColor(ACCENT)
    .text(`SECTION ${String(index + 1).padStart(2, "0")}`, M.left, doc.y, { characterSpacing: 1.6 });
  doc.moveDown(0.35);
  doc.font("Helvetica-Bold").fontSize(23).fillColor(INK)
    .text(section.label, M.left, doc.y, { width: CONTENT_W });
  doc.moveDown(0.2);
  doc.font("Helvetica").fontSize(9.5).fillColor(MUTED)
    .text(
      section.rows.length === 0
        ? EMPTY_VALUE
        : `${section.rows.length} ${section.rows.length === 1 ? section.singular.toLowerCase() : "records"}`,
      { width: CONTENT_W }
    );
  doc.y += 14;
  drawStatusBar(doc, section);
  hairline(doc, doc.y, RULE);
  doc.y += 18;

  if (section.rows.length === 0) {
    doc.roundedRect(M.left, doc.y, CONTENT_W, 54, 5).fill(CARD_BG);
    doc.font("Helvetica-Oblique").fontSize(10).fillColor(FAINT)
      .text(EMPTY_VALUE, M.left, doc.y + 21, { width: CONTENT_W, align: "center" });
    doc.y += 54;
    return pageIndex;
  }

  for (const row of section.rows) drawRecord(doc, section, row);
  return pageIndex;
}

/* ------------------------------------------------------------------ cover */

interface TocSlot { page: number; y: number }

function drawCover(doc: Doc, bundle: ExportBundle): TocSlot[] {
  // Masthead.
  doc.rect(0, 0, PAGE.width, 236).fill(ACCENT);
  doc.rect(0, 226, PAGE.width, 10).fill(ACCENT_DEEP);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff")
    .text("BUGBASE", M.left, 62, { characterSpacing: 3.6 });
  doc.font("Helvetica-Bold").fontSize(30).fillColor("#ffffff")
    .text(bundle.project.name, M.left, 96, { width: CONTENT_W - 40 });
  doc.font("Helvetica").fontSize(12.5).fillColor("#dfe5ff")
    .text("Workspace Export", M.left, doc.y + 6, { width: CONTENT_W });

  // Project key badge.
  doc.font("Helvetica-Bold").fontSize(9);
  const kw = doc.widthOfString(bundle.project.key) + 18;
  doc.roundedRect(M.left, 186, kw, 20, 10).fill("#ffffff");
  doc.fillColor(ACCENT_DEEP).text(bundle.project.key, M.left, 192, { width: kw, align: "center", lineBreak: false });

  // Stat strip.
  doc.y = 268;
  const stats: [string, string][] = [
    ["Modules", String(bundle.sections.length)],
    ["Records", bundle.totalRecords.toLocaleString("en-GB")],
    ["Generated", bundle.generatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })],
  ];
  const sw = (CONTENT_W - 24) / 3;
  stats.forEach(([k, v], i) => {
    const x = M.left + i * (sw + 12);
    doc.roundedRect(x, doc.y, sw, 62, 6).fill(CARD_BG);
    doc.font("Helvetica-Bold").fontSize(21).fillColor(INK).text(v, x + 14, doc.y + 13, { width: sw - 28 });
    label(doc, k, x + 14, doc.y + 42, sw - 28);
  });
  doc.y += 62 + 18;

  const by = doc.y;
  doc.font("Helvetica").fontSize(8.6).fillColor(MUTED)
    .text(
      `Generated by ${bundle.generatedBy} · ${bundle.generatedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
      M.left, by, { width: CONTENT_W }
    );
  doc.y = by + 24;

  // Contents — page numbers are filled in after the body is laid out.
  doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text("Contents", M.left, doc.y);
  doc.y += 6;
  hairline(doc, doc.y, RULE);
  doc.y += 10;

  const slots: TocSlot[] = [];
  bundle.sections.forEach((s, i) => {
    ensure(doc, 22);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(FAINT)
      .text(String(i + 1).padStart(2, "0"), M.left, y + 1, { width: 22, lineBreak: false });
    doc.font("Helvetica").fontSize(9.8).fillColor(INK)
      .text(s.label, M.left + 24, y, { width: CONTENT_W - 140, lineBreak: false });
    doc.font("Helvetica").fontSize(8.6).fillColor(s.rows.length ? MUTED : FAINT)
      .text(
        s.rows.length ? `${s.rows.length} ${s.rows.length === 1 ? "record" : "records"}` : "empty",
        M.left + CONTENT_W - 150, y + 1, { width: 100, align: "right", lineBreak: false }
      );
    slots.push({ page: doc.bufferedPageRange().count - 1, y });
    doc.y = y + 19;
    hairline(doc, doc.y - 6);
  });
  return slots;
}

/** Write the resolved page number into each contents row. */
function fillContents(doc: Doc, slots: TocSlot[], pages: number[]) {
  slots.forEach((slot, i) => {
    if (pages[i] === undefined) return;
    doc.switchToPage(slot.page);
    doc.font("Helvetica-Bold").fontSize(8.8).fillColor(ACCENT)
      .text(String(pages[i] + 1), M.left + CONTENT_W - 40, slot.y + 1, {
        width: 40, align: "right", lineBreak: false,
      });
  });
}

function paginate(doc: Doc, bundle: ExportBundle) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    if (i === 0) continue; // cover keeps its clean masthead

    // The footer sits below the bottom margin, and pdfkit appends a fresh page
    // whenever text crosses that line. Drop the margin for the write so the
    // pass does not grow the document it is numbering.
    const saved = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const y = PAGE.height - 36;
    hairline(doc, y - 8);
    doc.font("Helvetica").fontSize(7).fillColor(FAINT)
      .text(`${bundle.project.name} · ${bundle.project.key}`, M.left, y, {
        width: CONTENT_W / 2, lineBreak: false,
      })
      .text(`${i + 1} / ${range.count}`, M.left + CONTENT_W / 2, y, {
        width: CONTENT_W / 2, align: "right", lineBreak: false,
      });

    doc.page.margins.bottom = saved;
  }
}

export function renderPdf(bundle: ExportBundle): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: M.top, bottom: M.bottom, left: M.left, right: M.right },
        bufferPages: true,
        info: {
          Title: `${bundle.project.name} — Workspace Export`,
          Author: bundle.generatedBy,
          Creator: "BugBase",
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const slots = drawCover(doc, bundle);
      const pages = bundle.sections.map((s, i) => drawSection(doc, s, i));
      fillContents(doc, slots, pages);
      paginate(doc, bundle);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
