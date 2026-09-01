export const theme = {
  accent: 'magenta',
  // ink-select-input's own default highlight color — every list in the app
  // (SkipList, Settings, AliasScreen, Playlists) already matches this via that
  // library. Named here so the two screens with a hand-rolled list
  // (Play's browse list, Picker's results) can match it too, instead of
  // drifting to theme.accent's magenta, which is reserved for headings/branding.
  selected: 'blue',
  // The second-most-prominent text in a screen: each screen's own subheading
  // (right below the "tribe-vibe" accent heading) and the song title in the
  // pre-mpv "Now playing" line. A light-blue/cyan complements accent's
  // magenta without being confusable with selected's blue.
  secondary: 'cyan',
  dim: 'gray',
  error: 'red',
  warning: 'yellow',
  success: 'green',
};
