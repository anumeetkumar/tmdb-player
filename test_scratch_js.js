const axios = require('axios');

const BASE_URL = 'https://player.vidzee.wtf';
const CHUNKS = [
    '/_next/static/chunks/app/embed/%5B%5B...params%5D%5D/page-4effd7945eb200a8.js',
    '/_next/static/chunks/120-57d36f6f6582eb82.js',
    '/_next/static/chunks/538-255c6c2530dc9c9f.js',
    '/_next/static/chunks/07b5dd1e-ff2efecd3363419a.js'
];

async function run() {
    for (const chunk of CHUNKS) {
        const url = BASE_URL + chunk;
        try {
            console.log("Fetching chunk:", url);
            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            const text = res.data;
            console.log(`Length: ${text.length}`);
            
            // Search for /api/ or fetch or axios or server query parameters or vdrk.site / kkphimplayer7.com / v7
            const keywords = ['/api/', 'vdrk.site', 'kkphimplayer7.com', 'fetch', 'axios', 'get', 'post', 'ajax', 'm3u8'];
            for (const kw of keywords) {
                const idx = text.indexOf(kw);
                if (idx !== -1) {
                    console.log(`  Found keyword "${kw}" around index ${idx}:`);
                    console.log(`  "${text.substring(Math.max(0, idx - 100), Math.min(text.length, idx + 100))}"\n`);
                }
            }
        } catch (e) {
            console.error("Error for chunk:", chunk, e.message);
        }
    }
}

run();
