import stringWidth from 'string-width';

const ELLIPSIS = '…';

function truncateToWidth(value, maxWidth) {
  if (stringWidth(value) <= maxWidth) return value;
  if (maxWidth <= 0) return '';
  if (maxWidth === 1) return ELLIPSIS;

  const segments = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].map(({ segment }) => segment)
    : [...value];
  let result = '';
  let width = 0;
  for (const segment of segments) {
    const segmentWidth = stringWidth(segment);
    if (width + segmentWidth + stringWidth(ELLIPSIS) > maxWidth) break;
    result += segment;
    width += segmentWidth;
  }
  return `${result}${ELLIPSIS}`;
}

// Ink's Output counts every code point that ansi-tokenize returns as a cell,
// including combining marks. string-width reports the actual terminal width
// of the whole title. Compensate the title box by that difference so Ink's
// serialized row still places the duration at the same visible column.
function inkOutputWidth(value) {
  return [...value].reduce((width, character) => {
    const characterWidth = Math.max(stringWidth(character), character.length > 1 ? 2 : 1);
    return width + characterWidth;
  }, 0);
}

export function buildSearchResultRows(results, terminalWidth = process.stdout.columns) {
  const maxDurationWidth = Math.max(0, ...results.map((result) =>
    result.duration ? stringWidth(`(${Math.round(result.duration)}s)`) : 0,
  ));
  // Picker is inside one column of padding on each side. Each row also has a
  // two-cell selection marker and a two-cell gap before its duration.
  const titleSpace = Number.isFinite(terminalWidth) ? terminalWidth - 6 - maxDurationWidth : Infinity;
  let maxTitleWidth = Math.max(1, titleSpace);
  let titles = results.map((result) => truncateToWidth(result.title, maxTitleWidth));
  // Ink counts some joined emoji sequences more cells than string-width's
  // terminal measurement. Reserve that compensation too, so it cannot push
  // the duration column past the edge of a narrow terminal.
  if (Number.isFinite(titleSpace)) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const maxInkCorrection = Math.max(0, ...titles.map((title) => inkOutputWidth(title) - stringWidth(title)));
      const nextWidth = Math.max(1, titleSpace - maxInkCorrection);
      if (nextWidth === maxTitleWidth) break;
      maxTitleWidth = nextWidth;
      titles = results.map((result) => truncateToWidth(result.title, maxTitleWidth));
    }
  }
  const titleColumnWidth = Math.max(0, ...titles.map((title) => stringWidth(title)));

  return results.map((result, index) => {
    const title = titles[index];
    const visibleTitleWidth = stringWidth(title);
    return {
      title,
      // The +2 is the visible gap before the duration. Add the per-title
      // correction between Ink's internal cell count and the real width.
      titleColumnWidth: titleColumnWidth + 2 + inkOutputWidth(title) - visibleTitleWidth,
      duration: result.duration ? `(${Math.round(result.duration)}s)` : '',
    };
  });
}
