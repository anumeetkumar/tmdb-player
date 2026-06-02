const axios = require('axios');

async function run() {
    const url = 'https://player.vidzee.wtf/_next/static/chunks/app/embed/%5B%5B...params%5D%5D/page-4effd7945eb200a8.js';
    try {
        console.log("Fetching chunk...");
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const content = res.data;
        
        console.log("\n--- eh() function context ---");
        const ehIdx = content.indexOf('async function eh()');
        if (ehIdx !== -1) {
            console.log(content.substring(ehIdx, ehIdx + 600));
        }

        console.log("\n--- eu() function context ---");
        const euIdx = content.indexOf('function eu(');
        if (euIdx !== -1) {
            console.log(content.substring(euIdx, euIdx + 1000));
        }
        
        // Let's also look for et.D or et definition around there
        console.log("\n--- et / et.D definitions search ---");
        // Print 1000 characters before eh() to see how et is defined
        if (ehIdx !== -1) {
            console.log(content.substring(ehIdx - 1000, ehIdx));
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
