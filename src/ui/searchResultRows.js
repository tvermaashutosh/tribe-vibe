import stringWidth from 'string-width';

// Ink's output buffer advances once for each Unicode character it receives.
// Measuring the whole Bengali/Indic string at once can combine vowel signs
// into graphemes, so use the per-character widths Ink will actually advance.
function inkOutputWidth(value) {
  return [...value].reduce((width, character) => width + stringWidth(character), 0);
}

// Keep each result's duration in the same column, after the widest title.
// alignColumns measures terminal display width, so wide Unicode titles align
// just like ordinary Latin titles.
export function buildSearchResultRows(results) {
  const maxTitleWidth = Math.max(0, ...results.map((result) => inkOutputWidth(result.title)));

  return results.map((result) => {
    const title = result.title;
    const padding = ' '.repeat(maxTitleWidth - inkOutputWidth(title));
    return {
      title: title + padding,
      duration: result.duration ? `(${Math.round(result.duration)}s)` : '',
    };
  });
}
