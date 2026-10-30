import test from 'node:test';
import assert from 'node:assert/strict';
import stringWidth from 'string-width';
import { buildSearchResultRows } from '../src/ui/searchResultRows.js';

function inkWidth(value) {
  return [...value].reduce((width, character) => width + Math.max(stringWidth(character), character.length > 1 ? 2 : 1), 0);
}

test('search result duration column stays aligned while long titles are clipped to the terminal width', () => {
  const input = [
    { title: 'A short title', duration: 99 },
    { title: 'A very long title that must not wrap onto several terminal rows', duration: 2_285 },
    { title: '🔥 SPEAK GOD’S WORD OVER YOUR BONES — LET YOUR FAITH BRING HEALING', duration: 9_934 },
  ];
  const rows = buildSearchResultRows(input, 60);

  assert.equal(rows.length, input.length);
  assert.ok(rows[1].title.endsWith('…'));
  assert.ok(rows[2].title.endsWith('…'));
  assert.ok(rows.every((row) => {
    const width = 2 + row.titleColumnWidth + stringWidth(row.duration);
    return width <= 58; // 60 terminal cells less App's two padding columns
  }));

  // Ink's internal cell count varies for some emoji sequences. The width
  // correction should still place every visible duration at the same cell.
  const visibleStarts = rows.map((row) => row.titleColumnWidth - inkWidth(row.title) + stringWidth(row.title));
  assert.equal(new Set(visibleStarts).size, 1);
});

test('short search results keep their full titles and duration labels', () => {
  const rows = buildSearchResultRows([
    { title: 'Song one', duration: 62 },
    { title: 'A longer song title', duration: 171 },
  ], 100);

  assert.deepEqual(rows.map((row) => row.title), ['Song one', 'A longer song title']);
  assert.deepEqual(rows.map((row) => row.duration), ['(62s)', '(171s)']);
});
