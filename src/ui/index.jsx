import React from 'react';
import { render, Box } from 'ink';
import App from './App.jsx';
import Picker from './Picker.jsx';

// The two entry points cli.js dynamically imports from dist/ui.js. Kept lazy
// (imported only when actually needed) so the typed play fast-path never has
// to load Ink/React at all when it's just resolving a deterministic alias.
// ctx is mutated after render() so components can see `unmountMenu` once it
// exists — needed because Play.jsx must tear the whole Ink app down before
// handing the terminal to a foreground mpv (see player/playForeground.js);
// Ink and mpv can't both own raw-mode stdin at once.
export function launchMenu(ctx) {
  const { unmount, waitUntilExit } = render(<App ctx={ctx} />);
  ctx.unmountMenu = unmount;
  return waitUntilExit();
}

// Wrapped in the exact same padding={1} Box App.jsx uses — a typed search
// (`tv some vague lyrics`) hands off straight to this Picker with no
// MainMenu/App in between, but it's still Ink, and it should look like it:
// same one-line breathing room above and below, not just whichever entry
// point happened to reach it.
export function pickFromSearch({ query, top, resolver, player, aliasRepo, playlistRepo, tokenRegistry }) {
  return new Promise((resolve) => {
    const { unmount } = render(
      <Box flexDirection="column" padding={1}>
        <Picker
          initialQuery={query}
          top={top}
          resolver={resolver}
          player={player}
          onConfirm={(item) => {
            unmount();
            resolve(item);
          }}
          onCancel={() => {
            unmount();
            resolve(null);
          }}
          onSaveAlias={
            aliasRepo && ((candidate, token) => aliasRepo.addSongAlias(token, candidate.videoId, candidate.title, tokenRegistry))
          }
          onAddToPlaylist={
            playlistRepo &&
            ((candidate, playlistName) => playlistRepo.addSong(playlistName, { videoId: candidate.videoId, title: candidate.title }))
          }
          playlists={playlistRepo ? playlistRepo.all().map((playlist) => playlist.name) : []}
        />
      </Box>,
    );
  });
}
