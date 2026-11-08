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

Every play started from the Play screen opens the `Now Playing` screen, then runs MPV attached to the terminal with its progress bar and keybindings (space to pause, arrows to seek, `<`/`>` to skip within a playlist, `q` to quit). The local file path is shown without a `Playing:` prefix; when private mode is off, the song title appears below it. The status line shows elapsed time, duration, and percent without the audio marker. Informational file-start logs are hidden; warnings and errors remain visible. The screen title stays above MPV's output while playback runs.

**Hotkeys** — meant to be bound to keys, not typed:

```
tv -pause -resume -next -prev -shuffle
```

Example `skhd` config:

```
cmd + alt - p : tv -pause
cmd + alt - n : tv -next
```

These control the background player. They have nothing to act on while a foreground play started from the app is running.

**`tv -kill`** — stops every mpv process on the machine, tribe-vibe's own or not: the background daemon, any foreground play, including one left orphaned (some terminal media players, mpv included, deliberately ignore SIGHUP so closing the window doesn't kill playback — that can leave a foreground `-loop`ing play running indefinitely with no controlling terminal and no way back in), and any other mpv session entirely unrelated to tribe-vibe that happens to be running. Unlike the hotkey flags above, this never touches the daemon/IPC connection itself, so it works even when that's the thing broken.

**Menu** (`tv`, no args) — `Play`, `Songs`, `Playlists`, `Artists`, `Settings`. Playing a song or playlist opens the `Now Playing` screen automatically; it is not a menu option. Songs and Artists are separate screens even though they're both just aliases under the hood (same `aliases.json`, same repository) — picking one apart from the other keeps each screen free of type-branching, and matches the real difference between them: a song or playlist alias plays in one click, an artist alias always opens an ambiguous search. Every alias is picked from search results and pinned by its actual video ID, so it never drifts if search rankings change later. Playlist names share the same namespace as aliases — no separate list to remember. The `Play` screen's own browse list only ever shows songs and playlists (never artists, since neither of those is a one-click play), grouped song → playlist, most-recently-touched first.

**Settings**:

- **Export about** — writes a one-page, text-only PDF (`~/Downloads/tribe-vibe-about.pdf`) covering what tribe-vibe is, its low-level design, and the design patterns it uses.
- **Export data** — writes every song, playlist, and artist alias to `~/Downloads/tribe-vibe-export.xlsx`.
- **Result count** — how many results the Picker shows per search (default 5).
- **Concurrent downloads** — how many songs a playlist play downloads at once, instead of strictly one at a time (default 2).
- **Help messages** — show or hide the gray keyboard hints in the app (default off).
- **Private mode** — hide song titles in playback output and show file paths instead (default on).
- **Troubleshoot** — read-only checks for mpv/yt-dlp/hotkey-daemon installation, available updates, and writable data directories, each with a suggested fix.
- **Reset all data** — wipes aliases, playlists, settings, and the audio cache, after a yes/no confirmation that defaults to "no."

## Data

Aliases, playlists, and settings live as plain JSON under your OS config directory. Downloaded audio is cached under your OS cache directory, keyed by video ID, so replaying something within the same session doesn't re-download it — the cache directory itself is wiped clean when a play session starts, so it never accumulates across sessions. A hotkey command (`tv -pause` and friends) never triggers this, since it never downloads anything itself; and if another tv process is already mid-session, a second one simply skips the wipe rather than risk deleting files the first one is still using. Nothing is streamed directly from a raw YouTube URL — every song, including every song in a playlist, is downloaded before playback starts.

## Known limitations

- A pinned song can go dead later (takedown, region lock) — you'll get a clear error and a chance to re-pick.
- A long playlist downloads every song, one at a time, before playback starts — the terminal sits idle until that finishes, since nothing plays until everything's ready.

## Debugging

Every run traces the full lifecycle of a play (download → foreground MPV → terminal restore → exit) and the background daemon's own IPC to a log file under your OS temp directory (`tribe-vibe-debug.log`). On by default; set `TRIBE_VIBE_TRACE=0` to opt out.

## Testing

```
npm test
```

Covers the alias/playlist/settings logic and the play-command classifier. The interactive menu itself isn't covered by automated tests (it needs a real terminal) — smoke-test it with `tv`.
