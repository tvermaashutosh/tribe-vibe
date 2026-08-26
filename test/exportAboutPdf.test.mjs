import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exportAboutPdf } from '../src/export/exportAboutPdf.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-about-pdf-test-'));
}

test('exportAboutPdf writes a valid single-page PDF with no images or embedded fonts', async () => {
  const dir = tempDir();

  const outputPath = await exportAboutPdf({ downloadsDir: dir });

  assert.equal(outputPath, path.join(dir, 'tribe-vibe-about.pdf'));
  const bytes = fs.readFileSync(outputPath);
  assert.equal(bytes.toString('ascii', 0, 5), '%PDF-');
  assert.ok(bytes.toString('ascii').trimEnd().endsWith('%%EOF'));

  const pdf = bytes.toString('latin1');
  assert.match(pdf, /\/Type \/Pages \/Kids \[3 0 R\] \/Count 1/); // exactly one page
  assert.doesNotMatch(pdf, /\/Image/); // no image XObjects anywhere
  assert.doesNotMatch(pdf, /\/FontFile/); // no embedded font program — base-14 only
});

test('exportAboutPdf uses real typography — WinAnsi-encoded Helvetica for dashes/quotes/bullets, Symbol font for a real arrow glyph', async () => {
  const dir = tempDir();
  const outputPath = await exportAboutPdf({ downloadsDir: dir });
  const pdf = fs.readFileSync(outputPath, 'latin1');

  assert.match(pdf, /\/BaseFont \/Helvetica \/Encoding \/WinAnsiEncoding/);
  assert.match(pdf, /\/BaseFont \/Helvetica-Bold \/Encoding \/WinAnsiEncoding/);
  assert.match(pdf, /\/BaseFont \/Symbol/);
  // Symbol code 0xAE (a real rightward-arrow glyph, confirmed by rendering)
  // must actually appear as its own Tj call switching through /F3.
  assert.match(pdf, /\/F3 9 Tf\n\(\xae\) Tj/);
});

test('exportAboutPdf covers the general, LLD, and design-pattern content', async () => {
  const dir = tempDir();
  const outputPath = await exportAboutPdf({ downloadsDir: dir });
  const pdf = fs.readFileSync(outputPath, 'latin1');

  assert.match(pdf, /keyboard-first CLI music player/); // general
  assert.match(pdf, /Repository layer/); // LLD
  assert.match(pdf, /Design Patterns/); // design patterns
  assert.match(pdf, /Adapter/);
  assert.match(pdf, /Proxy/);
  assert.match(pdf, /Factory/);
  assert.match(pdf, /Builder/);
  assert.match(pdf, /Singleton\/Supervisor/);
  assert.match(pdf, /Strategy/);
  assert.match(pdf, /Chain of Responsibility/);
  assert.match(pdf, /State/);
  assert.match(pdf, /Command/);
  assert.match(pdf, /Facade/);
});

test('exportAboutPdf keeps every line of text within the page bounds', async () => {
  const dir = tempDir();
  const outputPath = await exportAboutPdf({ downloadsDir: dir });
  const pdf = fs.readFileSync(outputPath, 'latin1');

  const positions = [...pdf.matchAll(/1 0 0 1 [\d.]+ ([\d.]+) Tm/g)].map((m) => Number(m[1]));
  assert.ok(positions.length > 10, 'expected many positioned text lines');
  for (const y of positions) {
    assert.ok(y > 0 && y < 792, `line at y=${y} is off the letter-size page`);
  }
});

test('exportAboutPdf overwrites a prior generation with the same name', async () => {
  const dir = tempDir();
  await exportAboutPdf({ downloadsDir: dir });
  const firstSize = fs.statSync(path.join(dir, 'tribe-vibe-about.pdf')).size;
  await exportAboutPdf({ downloadsDir: dir });
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.pdf'));
  assert.deepEqual(files, ['tribe-vibe-about.pdf']);
  assert.equal(fs.statSync(path.join(dir, 'tribe-vibe-about.pdf')).size, firstSize);
});

test('exportAboutPdf creates the downloads directory if it does not exist yet', async () => {
  const missingDir = path.join(tempDir(), 'nested', 'downloads');
  const outputPath = await exportAboutPdf({ downloadsDir: missingDir });
  assert.ok(fs.existsSync(outputPath));
});
