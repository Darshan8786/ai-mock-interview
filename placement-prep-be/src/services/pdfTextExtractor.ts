/**
 * Local, offline PDF text extraction (pdfjs-dist - no external API).
 *
 * pdf.js exposes text as a flat list of positioned glyphs/runs per page, with
 * no explicit line breaks. Joining every run on a page with a single space
 * throws away line structure entirely - fine for feeding a prompt to an LLM,
 * but useless for local section/field parsing (you can't find "EXPERIENCE"
 * as its own line, or tell where one bullet ends and the next begins, from
 * one giant blob of text).
 *
 * This clusters text runs into lines by Y position (their PDF transform
 * matrix's vertical offset), then orders each line left-to-right by X
 * position, so downstream parsing can work the way a human reads the page.
 *
 * Two-column templates (a sidebar for skills/contact next to a main content
 * column - extremely common in free resume templates) break the naive
 * single-stream approach: a sidebar line and a main-column line that happen
 * to sit at the same Y get merged into one garbled line, interleaving two
 * unrelated pieces of text and corrupting every downstream regex (dates,
 * degrees, bullets, section headers). detectGutterX() looks for a
 * consistent vertical gap that separates two columns across many lines; when
 * found, each column is read top-to-bottom as its own stream instead.
 */

export interface ExtractedResumeText {
  /** Full text with real line breaks - use this for local parsing. */
  text: string;
  /** Same content as an array of trimmed, non-empty lines. */
  lines: string[];
}

interface PositionedItem {
  str: string;
  x: number;
  xEnd: number;
  y: number;
}

const LINE_Y_TOLERANCE = 3; // px; runs within this Y delta are the same line

// Column-gutter detection thresholds. A resume sidebar gutter is typically
// 15-40pt wide; requiring it to recur across a solid majority of the lines
// that actually span that x-position (not just "any line has a gap
// somewhere") avoids mistaking one widely-spaced line (e.g. a name banner or
// a right-aligned date) for a real column boundary.
const MIN_GUTTER_WIDTH = 18;
const GUTTER_BIN_SIZE = 8;
const MIN_GUTTER_COVERAGE_RATIO = 0.45;
const MIN_LINES_FOR_COLUMN_DETECTION = 8;
const MIN_SIDE_LINES = 4;

function clusterIntoLines(items: PositionedItem[]): PositionedItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PositionedItem[][] = [];
  let currentY: number | null = null;
  let current: PositionedItem[] = [];

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) <= LINE_Y_TOLERANCE) {
      current.push(item);
      currentY = currentY === null ? item.y : currentY;
    } else {
      lines.push(current);
      current = [item];
      currentY = item.y;
    }
  }
  if (current.length) lines.push(current);
  for (const line of lines) line.sort((a, b) => a.x - b.x);
  return lines;
}

function lineText(items: PositionedItem[]): string {
  return items
    .map((it) => it.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Finds an x-position that consistently separates two text columns across
 * this page's lines. Returns null when the page reads as a single column, so
 * callers fall back to the original top-to-bottom line order unchanged. */
function detectGutterX(lines: PositionedItem[][]): number | null {
  if (lines.length < MIN_LINES_FOR_COLUMN_DETECTION) return null;

  const bucketOf = (x: number) => Math.round(x / GUTTER_BIN_SIZE) * GUTTER_BIN_SIZE;
  const candidateBuckets = new Set<number>();
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const gap = line[i + 1].x - line[i].xEnd;
      if (gap >= MIN_GUTTER_WIDTH) {
        candidateBuckets.add(bucketOf(line[i].xEnd + gap / 2));
      }
    }
  }
  if (candidateBuckets.size === 0) return null;

  let bestX: number | null = null;
  let bestScore = 0;
  for (const bucketX of candidateBuckets) {
    let spanning = 0;
    let withGap = 0;
    for (const line of lines) {
      const startsBefore = line[0].x < bucketX;
      const endsAfter = line[line.length - 1].xEnd > bucketX;
      if (!startsBefore || !endsAfter) continue; // this line doesn't cross the candidate gutter at all
      spanning++;
      const hasGapHere = line.some(
        (it, i) => i < line.length - 1 && it.xEnd <= bucketX && line[i + 1].x >= bucketX
      );
      if (hasGapHere) withGap++;
    }
    if (spanning < MIN_LINES_FOR_COLUMN_DETECTION) continue;
    if (withGap / spanning >= MIN_GUTTER_COVERAGE_RATIO && withGap > bestScore) {
      bestScore = withGap;
      bestX = bucketX;
    }
  }
  return bestX;
}

function splitByGutter(
  lines: PositionedItem[][],
  gutterX: number
): { left: PositionedItem[][]; right: PositionedItem[][] } {
  const left: PositionedItem[][] = [];
  const right: PositionedItem[][] = [];
  for (const line of lines) {
    const leftItems = line.filter((it) => it.x < gutterX);
    const rightItems = line.filter((it) => it.x >= gutterX);
    if (leftItems.length) left.push(leftItems);
    if (rightItems.length) right.push(rightItems);
  }
  return { left, right };
}

export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractedResumeText> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  const allLines: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    const items: PositionedItem[] = content.items
      .filter((item: any) => "str" in item && item.str.trim().length > 0)
      .map((item: any) => {
        // pdf.js normally reports a real `width`; fall back to a rough
        // character-count estimate for the rare item that omits it so gutter
        // detection still has an x-extent to work with.
        const width = typeof item.width === "number" && item.width > 0 ? item.width : item.str.length * 5;
        return { str: item.str, x: item.transform[4], xEnd: item.transform[4] + width, y: item.transform[5] };
      });

    const lines = clusterIntoLines(items);
    const gutterX = detectGutterX(lines);

    let orderedLines = lines;
    if (gutterX !== null) {
      const { left, right } = splitByGutter(lines, gutterX);
      if (left.length >= MIN_SIDE_LINES && right.length >= MIN_SIDE_LINES) {
        // Read each column top-to-bottom in full before moving to the next,
        // instead of interleaving unrelated sidebar/main-column lines by Y.
        orderedLines = [...left, ...right];
      }
    }

    for (const line of orderedLines) {
      const text = lineText(line);
      if (text) allLines.push(text);
    }
  }

  await loadingTask.destroy();

  return { text: allLines.join("\n"), lines: allLines };
}
