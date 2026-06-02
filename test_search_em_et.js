const axios = require('axios');

async function run() {
    const url = 'https://player.vidzee.wtf/_next/static/chunks/app/embed/%5B%5B...params%5D%5D/page-4effd7945eb200a8.js';
    try {
        console.log("Fetching main chunk...");
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const content = res.data;

        console.log("\nSearching for 'em' definition...");
        let idx = 0;
        while ((idx = content.indexOf('em', idx)) !== -1) {
            const snippet = content.substring(idx - 30, idx + 50);
            if (snippet.includes('=') || snippet.includes('const') || snippet.includes('let') || snippet.includes('var')) {
                console.log(`Occurrence at ${idx}: "${snippet}"`);
            }
            idx += 2;
        }

        console.log("\nSearching for module 3469 reference...");
        // In webpack, modules are defined in key-value format like `3469: (e, t, r) => { ... }` or similar.
        // Let's search all chunks for "3469:" or "3469," or in other chunks!
        // We know from test_scratch_js.js there are other chunks:
        // '120-57d36f6f6582eb82.js', '538-255c6c2530dc9c9f.js', '07b5dd1e-ff2efecd3363419a.js'
        
        const chunks = [
            '/_next/static/chunks/app/embed/%5B%5B...params%5D%5D/page-4effd7945eb200a8.js',
            '/_next/static/chunks/120-57d36f6f6582eb82.js',
            '/_next/static/chunks/538-255c6c2530dc9c9f.js',
            '/_next/static/chunks/07b5dd1e-ff2efecd3363419a.js'
        ];
        
        for (const c of chunks) {
            console.log(`\nSearching in chunk ${c}...`);
            const chunkRes = await axios.get('https://player.vidzee.wtf' + c, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const cContent = chunkRes.data;
            
            // Search for "3469"
            let cIdx = 0;
            while ((cIdx = cContent.indexOf('3469', cIdx)) !== -1) {
                console.log(`  Found "3469" at ${cIdx}: "${cContent.substring(cIdx - 40, cIdx + 80)}"`);
                cIdx += 4;
            }
            
            // Also let's search for "em" in this chunk if we didn't find it clearly
            let emIdx = 0;
            while ((emIdx = cContent.indexOf('em', emIdx)) !== -1) {
                const snippet = cContent.substring(emIdx - 30, emIdx + 50);
                if (snippet.includes('em =') || snippet.includes('em=') || snippet.includes('const em') || snippet.includes('let em')) {
                    console.log(`  Found "em" definition in ${c} at ${emIdx}: "${snippet}"`);
                }
                emIdx += 2;
            }
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
