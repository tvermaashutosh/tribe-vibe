# tribe-vibe

A keyboard-first CLI music player. Type an alias, hit play — mpv handles the rest.

```
tv tsw tt -loop=10   # play Taylor Swift's "22", looped 10 times — order/case/spacing don't matter
tv -pause            # hotkey control
tv                   # interactive menu
```

## Install

Requires Node.js 18+, [mpv](https://mpv.io), and [yt-dlp](https://github.com/yt-dlp/yt-dlp). For hotkeys, a keybinding daemon: `skhd` (macOS), `sxhkd` (Linux), or AutoHotkey (Windows).

```
npm run setup
```

Installs npm packages, builds, and links `tv`/`tribe-vibe` onto your PATH, then checks whether mpv/yt-dlp/the hotkey daemon are actually present and prints the exact install command for whatever's missing (never runs it for you, unless you ask):

```
npm run setup -- --install-deps
```

Equivalent to doing it by hand:

```
npm install
npm run build
npm link
```

## Usage

**Play by typing** — order never matters, matching is case-insensitive:

```
tv tsw tt -loop=10        # any order works, and so does -loop=10 tsw tt
tv focus                  # play a playlist by name
tv some vague lyrics      # no alias match -> opens a picker to disambiguate
tv -q "literal search"    # bypass alias matching entirely — anywhere on the line, same as -loop
```

Nothing is reserved except your own alias/playlist names — `-l`/`-loop` and `-q`/`-query` are real flags, not blocked words, so a song actually titled "loop" still types as itself. Volume is mpv's own; tribe-vibe doesn't set or remember it.

Every play — typed or from the menu's `Play` screen — runs mpv attached to your terminal with its native progress bar and keybindings (space to pause, arrows to seek, `<`/`>` to skip within a playlist, `q` to quit). Each song's real title is printed as it starts, not just its cache file path. The terminal stays occupied until playback ends.

**Hotkeys** — meant to be bound to keys, not typed:

```
tv -pause -resume -next -prev -shuffle
```

Example `skhd` config:

```
cmd + alt - p : tv -pause
cmd + alt - n : tv -next
```

These control a background player, separate from a directly typed `tv <song>` — they have nothing to act on while a direct play is running.

**`tv -kill`** — stops every mpv process tribe-vibe itself has ever spawned: the background daemon, and any foreground play, including one left orphaned (some terminal media players, mpv included, deliberately ignore SIGHUP so closing the window doesn't kill playback — that can leave a foreground `-loop`ing play running indefinitely with no controlling terminal and no way back in). Unlike the hotkey flags above, this never touches the daemon/IPC connection itself, so it works even when that's the thing broken.

**Menu** (`tv`, no args) — manage artist aliases, song aliases, and playlists. Every alias is picked from search results and pinned by its actual video ID, so it never drifts if search rankings change later. Playlist names share the same namespace as aliases — no separate list to remember, and both the alias list and the `Play` screen's browse list are grouped song → artist → playlist, most-recently-touched first.

**Settings**:

- **About** — writes a one-page, text-only PDF (`~/Downloads/tribe-vibe-about.pdf`) covering what tribe-vibe is, its low-level design, and the design patterns it uses.
- **Export data** — writes every alias and playlist to `~/Downloads/tribe-vibe-export.xlsx`.
- **Troubleshoot** — read-only checks for mpv/yt-dlp/hotkey-daemon installation, available updates, and writable data directories, each with a suggested fix.
- **Reset all data** — wipes aliases, playlists, settings, and the audio cache, after a yes/no confirmation that defaults to "no."

## Data

Aliases, playlists, and settings live as plain JSON under your OS config directory. Downloaded audio is cached under your OS cache directory, keyed by video ID, so replaying something within the same session doesn't re-download it — the cache directory itself is wiped clean when a play session starts (the interactive menu, or a direct typed play), so it never accumulates across sessions. A hotkey command (`tv -pause` and friends) never triggers this, since it never downloads anything itself; and if another tv process is already mid-session, a second one simply skips the wipe rather than risk deleting files the first one is still using. Nothing is streamed directly from a raw YouTube URL — every song, including every song in a playlist, is downloaded before playback starts.

## Known limitations

- A pinned song can go dead later (takedown, region lock) — you'll get a clear error and a chance to re-pick.
- A long playlist downloads every song, one at a time, before playback starts — the terminal sits idle until that finishes, since nothing plays until everything's ready.

## Testing

```
npm test
```

Covers the alias/playlist/settings logic and the play-command classifier. The interactive menu itself isn't covered by automated tests (it needs a real terminal) — smoke-test it with `tv`.
