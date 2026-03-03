const { addonBuilder } = require('stremio-addon-sdk');
const puppeteerCore = require('puppeteer-core');
const chromium = require('@sparticuz/chromium'); 

const manifest = {
    id: 'org.coverapi.stremio',
    version: '1.0.1', // Змінено версію, щоб Stremio оновив кеш
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
    
    console.log(`[START] Шукаю відео для: ${targetUrl}`);
    
    let browser = null;
    let streamUrl = null;
    let allRequests = [];

    try {
        browser = await puppeteerCore.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(), 
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        
        // Змінюємо User-Agent, щоб сайт думав, що це звичайний комп'ютер
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.setRequestInterception(true);
        
        page.on('request', (request) => {
            const url = request.url();
            allRequests.push(url); // Записуємо всі запити для логів
            
            // Розширений пошук посилань на відео
            if (url.includes('.m3u8') || url.includes('.mp4') || url.includes('master.m3u8') || url.includes('/playlist.m3u8')) {
                if (!url.includes('ad_') && !url.includes('blank') && !url.includes('google')) { 
                    streamUrl = url;
                    console.log(`[SUCCESS] Знайдено відео: ${streamUrl}`);
                }
            }
            request.continue();
        });

        console.log('[NAVIGATE] Заходимо на сторінку...');
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
        
        console.log('[WAIT] Чекаємо 3 секунди на завантаження скриптів...');
        // Збільшили час очікування до 3 секунд
        await new Promise(r => setTimeout(r, 3000));

    } catch (error) {
        console.log(`[ERROR] Помилка парсингу: ${error.message}`);
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }

    if (streamUrl) {
        return Promise.resolve({
            streams: [{ title: `▶ CoverAPI (Грецька)`, url: streamUrl }]
        });
    } else {
        console.log(`[FAILED] Відео не знайдено. Перевірено запитів: ${allRequests.length}`);
        console.log(`[DEBUG] Останні 5 запитів: ${allRequests.slice(-5).join('\n')}`);
        
        // Віддаємо у Stremio тестову "заглушку", щоб ви бачили, що аддон точно працює, але нічого не знайшов
        return Promise.resolve({ 
            streams: [
                { 
                    title: `❌ CoverAPI: Не знайдено відео (ID: ${imdbId})`, 
                    url: 'http://test.url/not-found.mp4' 
                }
            ] 
        });
    }
});

// Спеціальний обробник для Vercel
const addonInterface = builder.getInterface();

module.exports = async function(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { url } = req;

    if (url === '/manifest.json') {
        return res.json(addonInterface.manifest);
    }

    if (url.startsWith('/stream/')) {
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

    res.send(`
        <h1>CoverAPI Greek Addon is Running! v1.0.1</h1>
        <p>Для встановлення додайте <b>/manifest.json</b> до цієї адреси та вставте в Stremio.</p>
    `);
};
