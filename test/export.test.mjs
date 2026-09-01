import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { exportToExcel } from '../src/export/exportToExcel.js';

function fakeAliasRepo(entries) {
  return { all: () => entries };
}

function fakePlaylistRepo(playlists) {
  return { all: () => playlists };
}

function fakeResolver() {
  return { toWatchUrl: (videoId) => `https://www.youtube.com/watch?v=${videoId}` };
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tribe-vibe-export-test-'));
}

test('exportToExcel writes artist/song/playlist sheets with full URLs, not hashes', async () => {
  const dir = tempDir();
  const aliasRepo = fakeAliasRepo([
    { token: 'ts', type: 'artist', value: 'Taylor Swift' },
    { token: 'tt', type: 'song', videoId: 'abc123', title: 'Taylor Swift - 22' },
  ]);
  const playlistRepo = fakePlaylistRepo([{ name: 'focus', songs: [{ videoId: 'xyz789', title: 'Some Song' }] }]);
  const resolver = fakeResolver();

  const outputPath = await exportToExcel({ aliasRepo, playlistRepo, resolver, downloadsDir: dir });

  assert.equal(outputPath, path.join(dir, 'tribe-vibe-export.xlsx'));
  assert.ok(fs.existsSync(outputPath));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(outputPath);

  const artistSheet = workbook.getWorksheet('Artists');
  assert.equal(artistSheet.getRow(1).getCell(2).value, 'Artist');
  assert.equal(artistSheet.getRow(2).getCell(1).value, 'ts');
  assert.equal(artistSheet.getRow(2).getCell(2).value, 'Taylor Swift');
  assert.equal(artistSheet.getRow(1).getCell(1).fill.fgColor.argb, 'FFFFFF00');

  const songSheet = workbook.getWorksheet('Songs');
  assert.equal(songSheet.getRow(2).getCell(3).value, 'https://www.youtube.com/watch?v=abc123');
  assert.equal(songSheet.getRow(1).getCell(1).fill.fgColor.argb, 'FFFFFF00');

  const playlistSheet = workbook.getWorksheet('Playlists');
  assert.equal(playlistSheet.getRow(1).getCell(1).value, 'Token');
  assert.equal(playlistSheet.getRow(2).getCell(1).value, 'focus');
  assert.equal(playlistSheet.getRow(2).getCell(4).value, 'https://www.youtube.com/watch?v=xyz789');

  // Sheet order matters — Songs, Playlists, Artists, in that order.
  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ['Songs', 'Playlists', 'Artists'],
  );
});

test('exportToExcel overwrites a prior export with the same name', async () => {
  const dir = tempDir();
  const resolver = fakeResolver();

  await exportToExcel({
    aliasRepo: fakeAliasRepo([{ token: 'a', type: 'artist', value: 'A' }]),
    playlistRepo: fakePlaylistRepo([]),
    resolver,
    downloadsDir: dir,
  });
  await exportToExcel({
    aliasRepo: fakeAliasRepo([{ token: 'b', type: 'artist', value: 'B' }]),
    playlistRepo: fakePlaylistRepo([]),
    resolver,
    downloadsDir: dir,
  });

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(dir, 'tribe-vibe-export.xlsx'));
  const artistSheet = workbook.getWorksheet('Artists');
  assert.equal(artistSheet.getRow(2).getCell(1).value, 'b');
  assert.equal(artistSheet.rowCount, 2);
});
