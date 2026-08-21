import path from 'node:path';
import fs from 'node:fs';
import ExcelJS from 'exceljs';

const EXPORT_FILE_NAME = 'tribe-vibe-export.xlsx';
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

function styleHeaderRow(sheet) {
  sheet.getRow(1).eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });
}

// Full YouTube URLs, not raw video hashes — the whole point of an export is
// for a human to open it and recognize what's in it. Same fixed file name
// every time, so re-exporting just overwrites the prior copy. Column widths
// are left at Excel's own default — no attempt to compute a custom width,
// since character count doesn't match how Excel actually renders proportional
// fonts (narrower letters/punctuation vs. the digit-width column unit).
export async function exportToExcel({ aliasRepo, playlistRepo, resolver, downloadsDir }) {
  const workbook = new ExcelJS.Workbook();

  const artistSheet = workbook.addWorksheet('Artist Aliases');
  artistSheet.columns = [
    { header: 'Token', key: 'token' },
    { header: 'Artist', key: 'artist' },
  ];
  aliasRepo
    .all()
    .filter((alias) => alias.type === 'artist')
    .forEach((alias) => artistSheet.addRow({ token: alias.token, artist: alias.value }));
  styleHeaderRow(artistSheet);

  const songSheet = workbook.addWorksheet('Song Aliases');
  songSheet.columns = [
    { header: 'Token', key: 'token' },
    { header: 'Title', key: 'title' },
    { header: 'YouTube URL', key: 'url' },
  ];
  aliasRepo
    .all()
    .filter((alias) => alias.type === 'song')
    .forEach((alias) => songSheet.addRow({ token: alias.token, title: alias.title, url: resolver.toWatchUrl(alias.videoId) }));
  styleHeaderRow(songSheet);

  const playlistSheet = workbook.addWorksheet('Playlists');
  playlistSheet.columns = [
    { header: 'Playlist', key: 'playlist' },
    { header: 'Position', key: 'position' },
    { header: 'Title', key: 'title' },
    { header: 'YouTube URL', key: 'url' },
  ];
  playlistRepo.all().forEach((playlist) => {
    if (playlist.songs.length === 0) {
      playlistSheet.addRow({ playlist: playlist.name, position: '', title: '(empty)', url: '' });
      return;
    }
    playlist.songs.forEach((song, index) => {
      playlistSheet.addRow({
        playlist: playlist.name,
        position: index + 1,
        title: song.title,
        url: resolver.toWatchUrl(song.videoId),
      });
    });
  });
  styleHeaderRow(playlistSheet);

  fs.mkdirSync(downloadsDir, { recursive: true });
  const outputPath = path.join(downloadsDir, EXPORT_FILE_NAME);
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}
