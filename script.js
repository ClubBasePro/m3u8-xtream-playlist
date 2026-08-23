const { generateSeriesM3u8, getDirectXtreamUrl } = require('./generate_playlist');

const manifest = [
  "https://warez.la/player_api.php?username=336813&password=458453",
  "https://starplustv.site/player_api.php?username=69754974281040&password=247129511903",
  "http://138.255.102.3:25461/player_api.php?username=FOXSPORTS1HDsd&password=RRZKamZw9a",
  "http://7go.xyz:8080/player_api.php?username=15junior&password=as1266375",
  "http://6oclock.xyz/player_api.php?username=oVTsSvYjZu&password=cAXDNm9LY9",
  "https://mainsrv.contentgftp.xyz/player_api.php?username=Geraldo&password=12345678",
  "http://iptv.nextnet.krd:25461/get.php?username=nextnet&password=3738",
];

/**
 * Convert any Xtream Codes URL (player_api.php or get.php) into direct M3U8 Playlist URL
 */
function xtreamToM3u8Url(urlStr, format = 'm3u8') {
  try {
    const parsed = new URL(urlStr);
    const username = parsed.searchParams.get('username');
    const password = parsed.searchParams.get('password');
    if (!username || !password) return null;
    return `${parsed.origin}/get.php?username=${username}&password=${password}&type=m3u_plus&output=${format}`;
  } catch {
    return null;
  }
}

console.log('=== Xtream Codes to M3U8 Playlist Converter ===\n');

// Convert sample manifest URLs
console.log('Generated M3U8 Playlist URLs from Manifest:');
manifest.forEach((url, i) => {
  const m3u8Url = xtreamToM3u8Url(url);
  console.log(`\n[${i + 1}] Source: ${url}`);
  console.log(`    M3U8 URL: ${m3u8Url}`);
});

console.log('\n================================================');
console.log('Tip: Run "npm run generate" to generate a complete .m3u8 file from local streams/ data.');

