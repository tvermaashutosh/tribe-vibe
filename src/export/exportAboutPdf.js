import path from 'node:path';
import fs from 'node:fs';

const EXPORT_FILE_NAME = 'tribe-vibe-about.pdf';
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT_MARGIN = 54;
const TOP_MARGIN = 54;

const REGULAR = 'F1';
const BOLD = 'F2';
const SYMBOL = 'F3';
const ARROW = '→';
const ARROW_SYMBOL_BYTE = 0xae;

// WinAnsiEncoding (cp1252) codes for the typographic characters this content
// uses beyond plain ASCII — confirmed correct by actually rendering a test
// PDF to an image and inspecting the glyphs, not assumed from a spec table.
const WINANSI_EXTRA = {
  '‘': 0x91, // ‘
  '’': 0x92, // ’
  '“': 0x93, // “
  '”': 0x94, // ”
  '•': 0x95, // •
  '–': 0x96, // –
  '—': 0x97, // —
  '…': 0x85, // …
};

// One page, real typography (dashes, curly quotes, bullets, an actual arrow
// glyph) but no color and no images — text only, per what was asked for.
const CONTENT = [
  { text: 'tribe-vibe', font: BOLD, size: 16 },
  { text: 'A keyboard-first CLI music player wrapping mpv. Type an alias, mpv plays it.', font: REGULAR, size: 9 },
  { blank: true },
  { text: 'What It Is', font: BOLD, size: 11 },
  { text: '• Wraps yt-dlp and mpv behind one flat namespace of song, artist, and playlist aliases.', font: REGULAR, size: 9 },
  { text: '• An alias stores a pinned YouTube video ID (or playlist name), not a search string,', font: REGULAR, size: 9 },
  { text: '  so it never drifts if search rankings change later.', font: REGULAR, size: 9 },
  { text: '• Every confirmed play runs mpv as a real foreground process attached to the terminal:', font: REGULAR, size: 9 },
  { text: '  native progress bar, native keybindings (space, arrows, q), nothing reimplemented.', font: REGULAR, size: 9 },
  { blank: true },
  { text: 'Design Patterns', font: BOLD, size: 11 },
  { text: '• Adapter — PlatformAdapter (per-OS paths), Player (wraps mpv’s IPC protocol)', font: REGULAR, size: 9 },
  { text: '• Proxy — MpvIpcClient stands in for the real mpv process across an IPC socket', font: REGULAR, size: 9 },
  { text: '• Factory — getPlatform() selects the right adapter for the current OS', font: REGULAR, size: 9 },
  { text: '• Builder — buildIntent() assembles the play intent step by step from parsed input', font: REGULAR, size: 9 },
  { text: '• Singleton/Supervisor — MpvDaemonSupervisor ensures exactly one background daemon', font: REGULAR, size: 9 },
  { text: '• Strategy — YoutubeResolver; today’s source is YouTube, swappable behind one interface', font: REGULAR, size: 9 },
  { text: '• Chain of Responsibility — enrichError() tries ordered yt-dlp failure signatures', font: REGULAR, size: 9 },
  { text: '• State — Picker’s phase variable drives which screen renders, and what’s valid next', font: REGULAR, size: 9 },
  { text: '• Pipeline — normalize → tokenize → classify → resolve, each stage independent', font: REGULAR, size: 9 },
  { text: '• Command — commandRegistry unifies every hotkey action into one dispatch table', font: REGULAR, size: 9 },
  { text: '• Repository — alias/playlist/settings storage decoupled from JSON file details', font: REGULAR, size: 9 },
  { text: '• Facade — cli.js is a thin orchestrator; no business logic lives there', font: REGULAR, size: 9 },
  { blank: true },
  { text: 'Low-Level Design', font: BOLD, size: 11 },
  { text: '• Repository layer (src/repository/): AliasRepository, PlaylistRepository,', font: REGULAR, size: 9 },
  { text: '  SettingsRepository. Plain JSON under the OS config dir, written via', font: REGULAR, size: 9 },
  { text: '  temp-file-then-rename for corruption safety.', font: REGULAR, size: 9 },
  { text: '• Pipeline (src/pipeline/): normalize → tokenize → classify → resolve. Token order,', font: REGULAR, size: 9 },
  { text: '  case, and surrounding whitespace never matter.', font: REGULAR, size: 9 },
  { text: '• Player layer (src/player/): two mpv processes, on purpose. A foreground mpv', font: REGULAR, size: 9 },
  { text: '  (playForeground.js) for every confirmed play — inherited stdio, mpv owns the', font: REGULAR, size: 9 },
  { text: '  terminal. A background daemon (mpvDaemonSupervisor.js) for hotkeys and the', font: REGULAR, size: 9 },
  { text: '  Picker’s preview, controlled over mpv’s own JSON IPC socket.', font: REGULAR, size: 9 },
  { text: '• Platform layer (src/platform/): one adapter per OS resolves config/cache/downloads', font: REGULAR, size: 9 },
  { text: '  paths and hotkey tooling.', font: REGULAR, size: 9 },
  { text: '• Resolver (src/resolvers/): wraps yt-dlp for search and download. Every song is', font: REGULAR, size: 9 },
  { text: '  downloaded to a local file before playback — never a raw URL handed to mpv, which', font: REGULAR, size: 9 },
  { text: '  avoids header and format-detection failures seen with direct streaming.', font: REGULAR, size: 9 },
  { blank: true },
  { text: 'Data and Storage', font: BOLD, size: 11 },
  { text: '• aliases.json, playlists.json, settings.json live under the OS config directory.', font: REGULAR, size: 9 },
  { text: '• Downloaded audio is cached under the OS cache directory, keyed by video ID, for the', font: REGULAR, size: 9 },
  { text: '  rest of that session — the cache directory is wiped clean at the start of every run.', font: REGULAR, size: 9 },
  { text: '• Every alias and playlist entry is stamped with an updatedAt; the Aliases screen', font: REGULAR, size: 9 },
  { text: '  and Play’s browse list both sort each group by most-recently-touched first.', font: REGULAR, size: 9 },
  { blank: true },
  { text: 'Generated by tribe-vibe — Settings → About', font: REGULAR, size: 7 },
];

function encodeWinAnsiChar(char) {
  const code = char.codePointAt(0);
  if (code < 0x80) return code;
  if (WINANSI_EXTRA[char] !== undefined) return WINANSI_EXTRA[char];
  throw new Error(`No WinAnsi mapping for character ${JSON.stringify(char)} (U+${code.toString(16)}) in About PDF content`);
}

function pdfLiteralFromBytes(bytes) {
  let out = '';
  for (const byte of bytes) {
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else out += String.fromCharCode(byte);
  }
  return out;
}

// Splits a line on the arrow character into runs tagged by which font they
// need. No base-14 Latin font's built-in glyph set includes an arrow, but
// Symbol (also base-14, no embedding needed) does — code 0xAE, confirmed by
// rendering. Consecutive Tj calls across the font switch chain onto one
// visual line automatically; no manual position math needed (confirmed the
// same way).
function splitRuns(text) {
  const runs = [];
  const parts = text.split(ARROW);
  parts.forEach((part, index) => {
    if (part) runs.push({ font: null, bytes: [...part].map(encodeWinAnsiChar) });
    if (index < parts.length - 1) runs.push({ font: SYMBOL, bytes: [ARROW_SYMBOL_BYTE] });
  });
  return runs;
}

// Fixed leading per font size rather than real font-metric measurement — the
// content above is hand-wrapped to fit the page width already, so this only
// needs to step the cursor down a sane amount per line, not lay out
// arbitrary text.
function lineHeight(size) {
  return Math.round(size * 1.3);
}

function buildContentStream() {
  const lines = [];
  let cursorY = PAGE_HEIGHT - TOP_MARGIN;
  let currentFont = null;
  let currentSize = null;

  lines.push('BT');
  for (const item of CONTENT) {
    const size = item.blank ? 9 : item.size;
    cursorY -= item.blank ? lineHeight(size) * 0.6 : lineHeight(size);
    if (item.blank) continue;

    lines.push(`1 0 0 1 ${LEFT_MARGIN} ${cursorY} Tm`);
    for (const run of splitRuns(item.text)) {
      const font = run.font || item.font;
      if (font !== currentFont || item.size !== currentSize) {
        lines.push(`/${font} ${item.size} Tf`);
        currentFont = font;
        currentSize = item.size;
      }
      lines.push(`(${pdfLiteralFromBytes(run.bytes)}) Tj`);
    }
  }
  lines.push('ET');

  return lines.join('\n');
}

// Hand-rolled, dependency-free PDF writer — deliberately not pulling in a
// PDF library for a single static, text-only page. Uncompressed content
// stream (no Flate) keeps this readable/debuggable and the file is tiny
// either way with no images involved.
function buildPdf() {
  const stream = buildContentStream();
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /Resources << /Font << /${REGULAR} 5 0 R /${BOLD} 6 0 R /${SYMBOL} 7 0 R >> >> /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents 4 0 R >>`,
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
}

export async function exportAboutPdf({ downloadsDir }) {
  fs.mkdirSync(downloadsDir, { recursive: true });
  const outputPath = path.join(downloadsDir, EXPORT_FILE_NAME);
  fs.writeFileSync(outputPath, buildPdf());
  return outputPath;
}
