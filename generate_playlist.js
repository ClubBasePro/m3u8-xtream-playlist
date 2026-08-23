const fs = require('fs');
const path = require('path');

/**
 * Generate M3U8 string from VOD (Movies) data with working direct streaming URLs
 */
function generateVodM3u8(vodStreams) {
  let m3u = '#EXTM3U\n';
  for (const item of vodStreams) {
    const title = (item.name || 'Untitled Movie').replace(/[\r\n]/g, ' ');
    const logo = item.stream_icon || '';
    const category = item.category_name || 'MOVIES';
    const id = item.stream_id || '1';
    const streamUrl = item.direct_url;

    m3u += `#EXTINF:-1 tvg-id="${id}" tvg-name="${title}" tvg-logo="${logo}" group-title="${category}" tvg-type="movie" type="movie",${title}\n`;
    m3u += `${streamUrl}\n`;
  }
  return m3u;
}

function generatePlaylists() {
  const streamsDir = path.join(__dirname, 'streams');
  const moviesFile = path.join(streamsDir, 'movies.json');

  if (fs.existsSync(moviesFile)) {
    const movies = JSON.parse(fs.readFileSync(moviesFile, 'utf8'));
    const m3uContent = generateVodM3u8(movies);

    // Save as movies_playlist.m3u8
    const moviesOutputFile = path.join(__dirname, 'movies_playlist.m3u8');
    fs.writeFileSync(moviesOutputFile, m3uContent, 'utf8');

    // Save as all_in_one_playlist.m3u8 (Only this 1 movie)
    const combinedFile = path.join(__dirname, 'all_in_one_playlist.m3u8');
    fs.writeFileSync(combinedFile, m3uContent, 'utf8');

    // Save as series_playlist.m3u8 (Only this 1 movie)
    const seriesOutputFile = path.join(__dirname, 'series_playlist.m3u8');
    fs.writeFileSync(seriesOutputFile, m3uContent, 'utf8');

    console.log(`✅ Generated single-movie playlist with working live stream -> ${moviesOutputFile}`);
  }
}

if (require.main === module) {
  generatePlaylists();
}

module.exports = {
  generateVodM3u8,
  generatePlaylists,
};
