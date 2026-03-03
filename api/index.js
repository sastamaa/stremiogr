const { addonBuilder } = require('stremio-addon-sdk');
const puppeteerCore = require('puppeteer-core');
const chromium = require('@sparticuz/chromium'); 

const manifest = {
    id: 'org.coverapi.stremio',
    version: '1.0.0',
    name: 'CoverAPI Greek Movies',
    description: 'Дивіться фільми та серіали з грецькою озвучкою/субтитрами',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

builder.defineStreamHandler(async (args) => {
    const imdbId = args.id.split(':')[0]; 
    const targetUrl = `https://coverapi.store/embed/${imdbId}/`;
    
    let browser = null;
    let streamUrl = null;

    try {
        browser = await puppeteerCore.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(), 
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setRequestInterception(true);
        
        page.on('request', (request) => {
            const url = request.url();
            if (url.includes('.m3u8') || url.includes('.mp4')) {
                if (!url.includes('ad_') && !url.includes('blank')) { 
                    streamUrl = url;
                }
            }
            request.continue();
        });

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await new Promise(r => setTimeout(r, 1500));

    } catch (error) {
        console.error('Помилка парсингу:', error.message);
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }

    if (streamUrl) {
        return Promise.resolve({
            streams: [{ title: `CoverAPI (Грецька)`, url: streamUrl }]
        });
    } else {
        return Promise.resolve({ streams: [] });
    }
});

// Спеціальний обробник для Vercel
const addonInterface = builder.getInterface();

module.exports = async function(req, res) {
    // Встановлюємо правильні заголовки для Stremio (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Маршрутизатор
    const { url } = req;

    if (url === '/manifest.json') {
        return res.json(addonInterface.manifest);
    }

    if (url.startsWith('/stream/')) {
        // Витягуємо параметри із запиту (наприклад, /stream/movie/tt14181714.json)
        const parts = url.split('/');
        if (parts.length >= 4) {
            const type = parts[2];
            const id = parts[3].replace('.json', '');
            
            try {
                const result = await addonInterface.get({ resource: 'stream', type, id });
                return res.json(result);
            } catch (err) {
                return res.status(500).json({ err: 'Handler error' });
            }
        }
    }

    // Якщо це головна сторінка або невідомий маршрут
    res.send(`
        <h1>CoverAPI Greek Addon is Running!</h1>
        <p>Для встановлення додайте <b>/manifest.json</b> до цієї адреси та вставте в Stremio.</p>
    `);
};
