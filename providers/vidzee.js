const axios = require('axios');
const crypto = require('crypto');

const PASSPHRASE = 'c4a8f1d7e2b9a6c3d0f5e8a1b7c4d9e2';
const API_KEY_URL = 'https://core.vidzee.wtf/api-key';

const VIDZEE_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
};

const SERVERS = [
    { sr: '0', name: 'Togi', audioLanguage: 'English' },
    { sr: '3', name: 'Achilles', audioLanguage: 'English' },
    { sr: '4', name: 'Nflix', audioLanguage: 'English' },
    { sr: '5', name: 'Drag', audioLanguage: 'English' },
    { sr: '6', name: 'Viet', audioLanguage: 'Vietnamese' },
    { sr: '7', name: 'Hindi', audioLanguage: 'Hindi' },
    { sr: '8', name: 'Bengali', audioLanguage: 'Bengali' },
    { sr: '9', name: 'Tamil', audioLanguage: 'Tamil' },
    { sr: '10', name: 'Telugu', audioLanguage: 'Telugu' },
    { sr: '11', name: 'Malayalam', audioLanguage: 'Malayalam' }
];

// AES-256-CBC Decryption for individual stream links
function decryptCBC(encryptedBase64, keyStr) {
    try {
        const decoded = Buffer.from(encryptedBase64, 'base64').toString('utf8');
        const [ivBase64, cipherTextBase64] = decoded.split(':');
        if (!ivBase64 || !cipherTextBase64) return '';

        const iv = Buffer.from(ivBase64, 'base64');
        const cipherText = Buffer.from(cipherTextBase64, 'base64');
        
        // Key should be padded to 32 bytes (AES-256)
        const paddedKey = Buffer.alloc(32);
        const keyBuffer = Buffer.from(keyStr, 'utf8');
        keyBuffer.copy(paddedKey, 0, 0, Math.min(keyBuffer.length, 32));

        const decipher = crypto.createDecipheriv('aes-256-cbc', paddedKey, iv);
        let decrypted = decipher.update(cipherText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch (e) {
        console.error(`[Vidzee] CBC Decryption error: ${e.message}`);
        return '';
    }
}

// AES-256-GCM Decryption for the master API key
function decryptGCM(encryptedBase64, keyStr) {
    try {
        const encryptedBytes = Buffer.from(encryptedBase64, 'base64');
        if (encryptedBytes.length <= 28) return '';

        const iv = encryptedBytes.slice(0, 12);
        const tag = encryptedBytes.slice(12, 28);
        const ciphertext = encryptedBytes.slice(28);

        const sha256 = crypto.createHash('sha256').update(keyStr).digest();

        const decipher = crypto.createDecipheriv('aes-256-gcm', sha256, iv);
        decipher.setAuthTag(tag);
        
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
    } catch (e) {
        console.error(`[Vidzee] GCM Decryption error: ${e.message}`);
        return '';
    }
}

async function getVidzeeStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null, sr = null) {
    // If sr is not provided (e.g. for generic aggregate streams endpoint), return placeholders instantly
    if (sr === null) {
        console.log(`[Vidzee] Aggregate query for TMDB ID: ${tmdbId}. Returning 10 server placeholders instantly.`);
        return SERVERS.map(server => ({
            name: `Vidzee ${server.name}`,
            title: `Vidzee ${server.name} [${server.audioLanguage}]`,
            url: `placeholder_vidzee_${server.sr}`,
            quality: 'Auto',
            provider: 'Vidzee',
            headers: {
                'Referer': 'https://player.vidzee.wtf/',
                'Origin': 'https://player.vidzee.wtf'
            }
        }));
    }

    console.log(`[Vidzee] On-Demand query for Server SR: ${sr}, TMDB ID: ${tmdbId}, Type: ${mediaType}`);

    try {
        const server = SERVERS.find(s => s.sr === String(sr));
        if (!server) {
            console.error(`[Vidzee] Requested invalid server SR: ${sr}`);
            return [];
        }

        // Step 1: Fetch and decrypt the master API key
        const keyRes = await axios.get(API_KEY_URL, { headers: VIDZEE_HEADERS, timeout: 5000 });
        const encryptedKey = keyRes.data;
        if (!encryptedKey) {
            console.error('[Vidzee] Failed to fetch API key.');
            return [];
        }

        const apiKey = decryptGCM(encryptedKey, PASSPHRASE);
        if (!apiKey) {
            console.error('[Vidzee] Failed to decrypt API key.');
            return [];
        }

        // Step 2: Query the single requested server on-demand
        let apiUrl = `https://player.vidzee.wtf/api/server?id=${tmdbId}&sr=${sr}`;
        if (mediaType === 'tv') {
            apiUrl += `&ss=${seasonNum}&ep=${episodeNum}`;
        }

        console.log(`[Vidzee] On-Demand Scraping single server: ${apiUrl}`);

        const apiRes = await axios.get(apiUrl, {
            headers: {
                ...VIDZEE_HEADERS,
                'Referer': `https://player.vidzee.wtf/embed/${mediaType}/${tmdbId}?server=${sr}`
            },
            timeout: 6000
        });

        const data = apiRes.data;
        if (!data || data.error) {
            console.warn(`[Vidzee] Server SR: ${sr} returned error: ${data ? data.error : 'empty response'}`);
            return [];
        }

        const streams = [];
        if (data.url && Array.isArray(data.url)) {
            for (const urlObj of data.url) {
                const decryptedUrl = decryptCBC(urlObj.link, apiKey);
                if (!decryptedUrl) continue;

                // Extract subtitles mapping if present
                let subtitleTracks;
                if (data.tracks && Array.isArray(data.tracks)) {
                    subtitleTracks = data.tracks.map(t => ({
                        url: t.url,
                        label: t.lang,
                        format: 'vtt'
                    }));
                }

                streams.push({
                    name: `Vidzee ${server.name}`,
                    title: `Vidzee ${server.name} [${server.audioLanguage}]`,
                    url: decryptedUrl,
                    quality: 'Auto',
                    provider: 'Vidzee',
                    subtitles: subtitleTracks,
                    headers: {
                        'Referer': 'https://player.vidzee.wtf/',
                        'Origin': 'https://player.vidzee.wtf'
                    }
                });
            }
        }

        console.log(`[Vidzee] Single Server ${server.name} Scraped successfully. Found ${streams.length} stream(s).`);
        return streams;

    } catch (err) {
        console.error(`[Vidzee] Single Server ${sr} fetch failed: ${err.message}`);
        return [];
    }
}

module.exports = { getVidzeeStreams };
