const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Categories to exclude (Portuguese soap operas, Turkish novelas, Brazilian domestic, Asian dramas, etc.)
const EXCLUDE_CATEGORY_IDS = new Set([
  '732', // NOVELAS
  '940', // NOVELAS ATUAIS
  '988', // NOVELAS TURCAS
  '804', // GLOBOPLAY
  '955', // BRASIL PARALELO
  '742', // DORAMAS (K-Drama)
  '888', // TOKUSATSU
  '912', // SHOWS NACIONAIS
  '906', // ANIMES
  '908', // ANIMES LEGENDADOS
]);

// Clean English Category Mapping
const ENGLISH_CAT_MAP = {
  '953': 'SERIES | NEW RELEASES',
  '783': 'SERIES | REALITY TV',
  '805': 'SERIES | NETFLIX',
  '870': 'SERIES | AMAZON PRIME',
  '871': 'SERIES | HBO & HBO MAX',
  '809': 'SERIES | DISNEY+',
  '869': 'SERIES | HULU & STAR+',
  '875': 'SERIES | APPLE TV+',
  '874': 'SERIES | STARZ & LIONSGATE+',
  '892': 'SERIES | DISCOVERY+',
  '899': 'SERIES | NATIONAL GEOGRAPHIC',
  '876': 'SERIES | PARAMOUNT+',
  '880': 'SERIES | CBS',
  '881': 'SERIES | ABC',
  '879': 'SERIES | FOX',
  '916': 'SERIES | TNT',
  '917': 'SERIES | NBC',
  '877': 'SERIES | HULU',
  '882': 'SERIES | WARNER BROS',
  '918': 'SERIES | SYFY',
  '884': 'SERIES | A&E',
  '883': 'SERIES | AMC',
  '919': 'SERIES | AXN',
  '898': 'SERIES | COMEDY CENTRAL',
  '897': 'SERIES | HISTORY CHANNEL',
  '885': 'SERIES | GENERAL DRAMA',
  '914': 'SERIES | TALK SHOWS',
  '895': 'SERIES | CLASSIC TV',
  '902': 'SERIES | MARVEL & DC',
  '893': 'SERIES | ANIMATION',
  '894': 'SERIES | KIDS & FAMILY',
  '909': 'SERIES | ANIMATED SITCOMS',
  '915': 'SERIES | MARVEL & DC ANIMATION',
  '911': 'SERIES | SITCOMS',
  '913': 'SERIES | INTERNATIONAL & CONCERTS',
};

// Non-English keywords filter
const FOREIGN_KEYWORDS = [
  /\bnovela\b/i,
  /\bbrasileir[oa]s?\b/i,
  /\bnacional\b/i,
  /\bturc[oa]s?\b/i,
  /\bcorean[oa]s?\b/i,
  /\bjapon[eê]s\b/i,
  /\bchines[ea]?\b/i,
  /\bespanhol\b/i,
  /\bmexican[oa]s?\b/i,
  /\bdorama\b/i,
  /\bk-drama\b/i,
  /\bbbb\b/i,
  /\bbig brother brasil\b/i,
  /\ba fazenda\b/i,
  /\bde f[eé]rias com o ex brasil\b/i,
  /\bcasamento [aà]s cegas brasil\b/i,
  /\bbrincando com fogo brasil\b/i,
];

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
 * Generate M3U8 string from Xtream Series data (English only)
 */
function generateSeriesM3u8(seriesList, categoriesList, host, username, password) {
  let m3u = '#EXTM3U\n';
  let count = 0;

  for (const item of seriesList) {
    const catId = String(item.category_id);
    if (EXCLUDE_CATEGORY_IDS.has(catId)) continue;

    const title = (item.name || 'Untitled').replace(/[\r\n]/g, ' ');
    const plot = item.plot || '';

    // Check for foreign keywords
    const isForeign = FOREIGN_KEYWORDS.some((rx) => rx.test(title) || rx.test(plot));
    if (isForeign) continue;

    const logo = item.cover || '';
    const category = ENGLISH_CAT_MAP[catId] || item.genre || 'Series';
    const id = item.series_id || item.num || '';
    const streamUrl = `${host.replace(/\/$/, '')}/series/${username}/${password}/${id}.mp4`;

    m3u += `#EXTINF:-1 tvg-id="${id}" tvg-name="${title}" tvg-logo="${logo}" group-title="${category}" tvg-type="series" type="series",${title}\n`;
    m3u += `${streamUrl}\n`;
    count++;
  }
  return { m3u, count };
}

/**
 * Generate M3U8 string from Xtream VOD (Movies) data
 */
function generateVodM3u8(vodStreams, host, username, password) {
  let m3u = '#EXTM3U\n';
  for (const item of vodStreams) {
    const title = (item.name || 'Untitled Movie').replace(/[\r\n]/g, ' ');
    const logo = item.stream_icon || '';
    const category = item.category_name || 'MOVIES | POPULAR';
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

  // 1. English TV Series
  if (fs.existsSync(seriesFile) && fs.existsSync(catFile)) {
    const series = JSON.parse(fs.readFileSync(seriesFile, 'utf8'));
    const categories = JSON.parse(fs.readFileSync(catFile, 'utf8'));
    const res = generateSeriesM3u8(series, categories, host, username, password);
    seriesM3u = res.m3u;
    const seriesOutputFile = path.join(__dirname, 'series_playlist.m3u8');
    fs.writeFileSync(seriesOutputFile, seriesM3u, 'utf8');
    console.log(`✅ Generated English Series Playlist (${res.count} English titles) -> ${seriesOutputFile}`);
  }

  // 2. English Movies
  if (fs.existsSync(moviesFile)) {
    const movies = JSON.parse(fs.readFileSync(moviesFile, 'utf8'));
    moviesM3u = generateVodM3u8(movies, host, username, password);
    const moviesOutputFile = path.join(__dirname, 'movies_playlist.m3u8');
    fs.writeFileSync(moviesOutputFile, moviesM3u, 'utf8');
    console.log(`✅ Generated English Movies Playlist (${movies.length} movies) -> ${moviesOutputFile}`);
  }

  // 3. Combined All-in-One Playlist (English Movies + English TV Series)
  if (seriesM3u || moviesM3u) {
    let combined = '#EXTM3U\n';
    if (moviesM3u) combined += moviesM3u.replace('#EXTM3U\n', '');
    if (seriesM3u) combined += seriesM3u.replace('#EXTM3U\n', '');
    const combinedFile = path.join(__dirname, 'all_in_one_playlist.m3u8');
    fs.writeFileSync(combinedFile, combined, 'utf8');
    console.log(`✅ Generated Combined English Playlist -> ${combinedFile}`);
  }
}

// 2. Fetch VOD & Series from an Xtream server (excluding live TV channels)
async function fetchAndGenerateFromXtream(host, username, password, outputName = 'all_in_one_playlist.m3u8') {
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
      const { m3u: seriesM3u, count } = generateSeriesM3u8(seriesList, seriesCats, host, username, password);
      combinedM3u += seriesM3u.replace('#EXTM3U\n', '');
      totalCount += count;
      console.log(`  -> Retrieved ${count} English Series`);
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
      const vodM3u = generateVodM3u8(vodList, host, username, password);
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
    console.log(`✅ Generated playlist (English Movies & Series) at: ${outputPath} (${totalCount} titles)`);
  } else {
    console.log('No Movies or Series could be retrieved from the server.');
  }
}

// Main execution logic supporting CLI args or default local conversion
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Xtream Codes to M3U8 Playlist Generator (English Only)

Usage:
  node generate_playlist.js [options]

Options:
  --server <url>       Xtream server URL (e.g. http://domain.com:8080)
  --user <username>    Xtream username
  --pass <password>    Xtream password
  --output <path>      Output .m3u8 filename (default: all_in_one_playlist.m3u8)
  --help, -h           Show this help message

Examples:
  node generate_playlist.js
  node generate_playlist.js --server http://example.com:8080 --user myuser --pass mypass
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
  const output = getArg('--output') || 'all_in_one_playlist.m3u8';

  if (server && user && pass) {
    console.log(`Generating playlist from Xtream server: ${server}`);
    await fetchAndGenerateFromXtream(server, user, pass, output);
  } else {
    generateFromLocalFiles();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', err.message);
  });
}

module.exports = {
  generateSeriesM3u8,
  generateVodM3u8,
  getDirectXtreamUrl,
  fetchAndGenerateFromXtream,
};
