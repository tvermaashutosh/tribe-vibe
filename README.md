# tribe-vibe

A keyboard-first CLI music player. Browse aliases and playlists or search from the app, then let mpv handle playback.

```
tv -pause            # hotkey control
tv                   # interactive app
```

## Install

Requires Node.js 18+, [mpv](https://mpv.io), and [yt-dlp](https://github.com/yt-dlp/yt-dlp). For hotkeys, a keybinding daemon: `skhd` (macOS), `sxhkd` (Linux), or AutoHotkey (Windows).

```
npm run setup
```

Installs npm packages, builds, and links `tv`/`tribe-vibe` onto your PATH, then checks whether mpv/yt-dlp/the hotkey daemon are actually present and prints the exact install command for each missing dependency (never runs it for you, unless you ask). When `--install-deps` is used, it installs only dependencies marked missing:

```
npm run setup -- --install-deps
```

Equivalent to doing it by hand:

```
npm install
npm run build
npm link
```

When `npm run setup` is run from Fish, it also installs a Fish integration that removes old `tv` and `tribe-vibe` commands at startup and removes each new launch before it can be saved to history. Start a new Fish session after setup (or source the installed `tribe-vibe-history.fish` file printed by setup) to enable it. This affects Fish command history and its suggestions; other shells need their own shell integration.

## Usage

**Play through the app** — run `tv`, open `Play`, then enter a song alias, playlist name, or search query. The Play screen accepts the same order-independent modifiers, including `-l`/`-loop` and `-q`/`-query`.

Nothing is reserved except your own alias/playlist names — a song actually titled "loop" still works when entered in the Play screen. Volume is MPV's own; tribe-vibe doesn't set or remember it.

Playing from the app hands the terminal to a foreground MPV process, with MPV's native progress bar and keybindings (space to pause, arrows to seek, `<`/`>` to skip within a playlist, `q` to quit). The local file path is shown without a `Playing:` prefix; with private mode off, the song title appears below it and the app's playback headings are visible. With private mode on (the default), titles and headings are hidden while the path remains visible. The status line shows elapsed time, duration, and percent without the audio marker. Informational file-start logs are hidden; warnings and errors remain visible.

**Hotkeys** — meant to be bound to keys, not typed. These control the background MPV daemon, not a foreground MPV process playing a song:

```
tv -pause -resume -next -prev -shuffle
```

Example `skhd` config:

```
cmd + alt - p : tv -pause
cmd + alt - n : tv -next
```

**`tv -kill`** — stops every mpv process on the machine, tribe-vibe's own or not: the background daemon, any foreground play, including one left orphaned (some terminal media players, mpv included, deliberately ignore SIGHUP so closing the window doesn't kill playback — that can leave a foreground `-loop`ing play running indefinitely with no controlling terminal and no way back in), and any other mpv session entirely unrelated to tribe-vibe that happens to be running. Unlike the hotkey flags above, this never touches the daemon/IPC connection itself, so it works even when that's the thing broken.

**Menu** (`tv`, no args) — `Play`, `Songs`, `Playlists`, `Artists`, `Settings`. Playback hands off to foreground MPV; playback headings are shown only when private mode is off. Songs and Artists are separate screens even though they're both stored in `aliases.json` — a song alias plays in one click, while an artist alias searches by its canonical artist name. Song aliases pin a video ID selected from search results, so they don't drift if search rankings change; artist aliases store a canonical name, not a video ID. Playlist names share the same namespace as aliases — no separate list to remember. The `Play` screen's browse list shows songs and playlists (not artists), grouped song → playlist, most-recently-touched first.

**Settings**:

- **Export about** — writes a one-page, text-only PDF (`~/Downloads/tribe-vibe-about.pdf`) covering what tribe-vibe is, its low-level design, and the design patterns it uses.
- **Export data** — writes every song, playlist, and artist alias to `~/Downloads/tribe-vibe-export.xlsx`.
- **Result count** — how many results the Picker shows per search (default 5).
- **Concurrent downloads** — maximum number of playlist tracks downloaded simultaneously (default 2).
- **Help messages** — show or hide the gray keyboard hints in the app (default off).
- **Private mode** — hide song titles and playback headings while keeping file paths visible (default on).
- **Troubleshoot** — read-only checks for mpv, yt-dlp, the hotkey daemon, yt-dlp updates, and writable data directories, with suggested fixes.
- **Reset all data** — wipes aliases, playlists, settings, and the audio cache, after a yes/no confirmation that defaults to "no."

## Data

Aliases, playlists, and settings live as plain JSON under your OS config directory. Confirmed-play audio is cached under your OS cache directory by video ID, so replaying within the same session doesn't re-download it. A new non-hotkey `tv` session attempts to clear the cache only if it acquires the session lock; hotkey commands (`tv -pause` and friends) don't acquire it, and a concurrent `tv` process skips cleanup to protect files in use. Confirmed plays download tracks locally before foreground MPV starts. Picker previews are the exception: they stream directly to the background MPV daemon for quick auditioning.

## Known limitations

- A pinned song can go dead later (takedown, region lock) — you'll get a clear error and a chance to re-pick.
- A long playlist waits for all tracks to finish downloading before playback starts. Downloads run up to the configured concurrency (default 2), and failed tracks are skipped; the terminal remains idle until downloads finish.

## Debugging

Every run traces the full lifecycle of a play (download → foreground MPV → terminal restore → exit) and the background daemon's own IPC to a log file under your OS temp directory (`tribe-vibe-debug.log`). On by default; set `TRIBE_VIBE_TRACE=0` to opt out.

## Testing

```
npm test
```

Covers the alias/playlist/settings logic, play-command classifier, navigation rules, and terminal-output helpers. Ink's interactive rendering and keyboard flow still require a real TTY — smoke-test the menu with `tv`.
