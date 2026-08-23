const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Helper to make HTTP/HTTPS GET requests
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Status Code: ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

/**
 * Generate M3U8 string from Xtream Series data
 */
function generateSeriesM3u8(seriesList, categoriesList, host, username, password) {
  const catMap = {};
  if (Array.isArray(categoriesList)) {
    categoriesList.forEach((c) => {
      catMap[c.category_id] = c.category_name;
    });
  }

  let m3u = '#EXTM3U\n';
  for (const item of seriesList) {
    const title = (item.name || 'Untitled').replace(/[\r\n]/g, ' ');
    const logo = item.cover || '';
    const category = catMap[item.category_id] || item.genre || 'Series';
    const id = item.series_id || item.num || '';
    const streamUrl = `${host.replace(/\/$/, '')}/series/${username}/${password}/${id}.mp4`;

    m3u += `#EXTINF:-1 tvg-id="${id}" tvg-name="${title}" tvg-logo="${logo}" group-title="${category}" tvg-type="series" type="series",${title}\n`;
    m3u += `${streamUrl}\n`;
  }
  return m3u;
}

/**
 * Generate M3U8 string from Xtream Live Streams data
 */
function generateLiveM3u8(liveStreams, categoriesList, host, username, password) {
  const catMap = {};
  if (Array.isArray(categoriesList)) {
    categoriesList.forEach((c) => {
      catMap[c.category_id] = c.category_name;
    });
  }

  let m3u = '#EXTM3U\n';
  for (const item of liveStreams) {
    const title = (item.name || 'Untitled Channel').replace(/[\r\n]/g, ' ');
    const logo = item.stream_icon || '';
    const category = catMap[item.category_id] || 'Live TV';
    const id = item.stream_id || item.num || '';
    const epgId = item.epg_channel_id || id;
    const streamUrl = `${host.replace(/\/$/, '')}/live/${username}/${password}/${id}.m3u8`;

    m3u += `#EXTINF:-1 tvg-id="${epgId}" tvg-name="${title}" tvg-logo="${logo}" group-title="${category}",${title}\n`;
    m3u += `${streamUrl}\n`;
  }
  return m3u;
}

/**
 * Generate M3U8 string from Xtream VOD (Movies) data
 */
function generateVodM3u8(vodStreams, categoriesList, host, username, password) {
  const catMap = {};
  if (Array.isArray(categoriesList)) {
    categoriesList.forEach((c) => {
      catMap[c.category_id] = c.category_name;
    });
  }

  let m3u = '#EXTM3U\n';
  for (const item of vodStreams) {
    const title = (item.name || 'Untitled Movie').replace(/[\r\n]/g, ' ');
    const logo = item.stream_icon || '';
    const category = catMap[item.category_id] || 'Movies';
    const id = item.stream_id || item.num || '';
    const ext = item.container_extension || 'mp4';
    const streamUrl = `${host.replace(/\/$/, '')}/movie/${username}/${password}/${id}.${ext}`;

    m3u += `#EXTINF:-1 tvg-id="${id}" tvg-name="${title}" tvg-logo="${logo}" group-title="${category}" tvg-type="movie" type="movie",${title}\n`;
    m3u += `${streamUrl}\n`;
  }
  return m3u;
}

/**
 * Generate direct Xtream M3U8 URL
 */
function getDirectXtreamUrl(host, username, password, output = 'm3u8') {
  return `${host.replace(/\/$/, '')}/get.php?username=${username}&password=${password}&type=m3u_plus&output=${output}`;
}

// 1. Generate M3U8 from offline local files in streams/ directory
function generateFromLocalFiles() {
  const streamsDir = path.join(__dirname, 'streams');
  const seriesFile = path.join(streamsDir, 'get_series_15junior_as1266375.json');
  const catFile = path.join(streamsDir, 'get_series_categories_15junior_as1266375.json');
  const moviesFile = path.join(streamsDir, 'movies.json');

  const host = 'http://7go.xyz:8080';
  const username = '15junior';
  const password = 'as1266375';

  let seriesM3u = '';
  let moviesM3u = '';

  // 1. Series
  if (fs.existsSync(seriesFile) && fs.existsSync(catFile)) {
    const series = JSON.parse(fs.readFileSync(seriesFile, 'utf8'));
    const categories = JSON.parse(fs.readFileSync(catFile, 'utf8'));
    seriesM3u = generateSeriesM3u8(series, categories, host, username, password);
    const seriesOutputFile = path.join(__dirname, 'series_playlist.m3u8');
    fs.writeFileSync(seriesOutputFile, seriesM3u, 'utf8');
    console.log(`✅ Generated series playlist (${series.length} series) -> ${seriesOutputFile}`);
  }

  // 2. Movies
  if (fs.existsSync(moviesFile)) {
    const movies = JSON.parse(fs.readFileSync(moviesFile, 'utf8'));
    const movieCats = [
      { category_id: '1', category_name: 'MOVIES | SCI-FI' },
      { category_id: '2', category_name: 'MOVIES | DRAMA' },
      { category_id: '3', category_name: 'MOVIES | ACTION' },
      { category_id: '4', category_name: 'MOVIES | ANIMATION' },
    ];
    moviesM3u = generateVodM3u8(movies, movieCats, host, username, password);
    const moviesOutputFile = path.join(__dirname, 'movies_playlist.m3u8');
    fs.writeFileSync(moviesOutputFile, moviesM3u, 'utf8');
    console.log(`✅ Generated movies playlist (${movies.length} movies) -> ${moviesOutputFile}`);
  }

  // 3. Combined All-in-One Playlist (Movies + TV Series)
  if (seriesM3u || moviesM3u) {
    let combined = '#EXTM3U\n';
    if (moviesM3u) combined += moviesM3u.replace('#EXTM3U\n', '');
    if (seriesM3u) combined += seriesM3u.replace('#EXTM3U\n', '');
    const combinedFile = path.join(__dirname, 'all_in_one_playlist.m3u8');
    fs.writeFileSync(combinedFile, combined, 'utf8');
    console.log(`✅ Generated combined (Movies + Series) playlist -> ${combinedFile}`);
  }
}

// 2. Fetch VOD & Series from an Xtream server (excluding live TV channels)
async function fetchAndGenerateFromXtream(host, username, password, outputName = 'vod_playlist.m3u8') {
  console.log(`Connecting to Xtream server: ${host}...`);
  const baseUrl = host.replace(/\/$/, '');

  let combinedM3u = '#EXTM3U\n';
  let totalCount = 0;

  // Fetch Series
  try {
    const [seriesCats, seriesList] = await Promise.all([
      fetchJson(`${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_series_categories`),
      fetchJson(`${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_series`),
    ]);
    if (Array.isArray(seriesList) && seriesList.length > 0) {
      const seriesM3u = generateSeriesM3u8(seriesList, seriesCats, host, username, password);
      // Remove header before appending
      combinedM3u += seriesM3u.replace('#EXTM3U\n', '');
      totalCount += seriesList.length;
      console.log(`  -> Retrieved ${seriesList.length} Series`);
    }
  } catch (err) {
    console.warn(`  -> Could not fetch Series: ${err.message}`);
  }

  // Fetch Movies (VOD)
  try {
    const [vodCats, vodList] = await Promise.all([
      fetchJson(`${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_vod_categories`),
      fetchJson(`${baseUrl}/player_api.php?username=${username}&password=${password}&action=get_vod_streams`),
    ]);
    if (Array.isArray(vodList) && vodList.length > 0) {
      const vodM3u = generateVodM3u8(vodList, vodCats, host, username, password);
      combinedM3u += vodM3u.replace('#EXTM3U\n', '');
      totalCount += vodList.length;
      console.log(`  -> Retrieved ${vodList.length} Movies`);
    }
  } catch (err) {
    console.warn(`  -> Could not fetch Movies: ${err.message}`);
  }

  if (totalCount > 0) {
    const outputPath = path.join(__dirname, outputName);
    fs.writeFileSync(outputPath, combinedM3u, 'utf8');
    console.log(`✅ Generated playlist (Movies & Series only) at: ${outputPath} (${totalCount} titles)`);
  } else {
    console.log('No Movies or Series could be retrieved from the server.');
  }
}

// Main execution logic supporting CLI args or default local conversion
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Xtream Codes to M3U8 Playlist Generator

Usage:
  node generate_playlist.js [options]

Options:
  --server <url>       Xtream server URL (e.g. http://domain.com:8080)
  --user <username>    Xtream username
  --pass <password>    Xtream password
  --file <path>        Custom JSON file containing series/streams
  --categories <path>  Custom categories JSON file
  --output <path>      Output .m3u8 filename (default: series_playlist.m3u8)
  --help, -h           Show this help message

Examples:
  node generate_playlist.js
  node generate_playlist.js --server http://7go.xyz:8080 --user 15junior --pass as1266375 --output my_playlist.m3u8
`);
    return;
  }

  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  };

  const server = getArg('--server');
  const user = getArg('--user');
  const pass = getArg('--pass');
  const customFile = getArg('--file');
  const customCat = getArg('--categories');
  const output = getArg('--output') || 'series_playlist.m3u8';

  if (server && user && pass) {
    console.log(`Generating playlist from Xtream server: ${server}`);
    console.log(`Direct M3U8 URL: ${getDirectXtreamUrl(server, user, pass, 'm3u8')}`);
    await fetchAndGenerateFromXtream(server, user, pass, output);
  } else if (customFile) {
    const series = JSON.parse(fs.readFileSync(customFile, 'utf8'));
    const categories = customCat && fs.existsSync(customCat) ? JSON.parse(fs.readFileSync(customCat, 'utf8')) : [];
    const host = server || 'http://localhost:8080';
    const username = user || 'user';
    const password = pass || 'pass';
    const m3uContent = generateSeriesM3u8(series, categories, host, username, password);
    fs.writeFileSync(path.resolve(process.cwd(), output), m3uContent, 'utf8');
    console.log(`✅ Playlist saved to: ${output}`);
  } else {
    generateFromLocalFiles();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', err.message);
  });
}
