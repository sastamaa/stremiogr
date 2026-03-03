const { addonBuilder, getRouter } = require('stremio-addon-sdk');
const puppeteerCore = require('puppeteer-core');
const chromium = require('@sparticuz/chromium-min');

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

// Пряме посилання на полегшений Chromium для Vercel
const CHROMIUM_PACK = 'https://github.com/Sparticuz/chromium/releases/download/v119.0.0/chromium-v119.0.0-pack.tar';

builder.defineStreamHandler(async (args) => {
    const imdbId = args.id.split(':')[0]; 
    const targetUrl = `https://coverapi.store/embed/${imdbId}/`;
    
    let browser = null;
    let streamUrl = null;

    try {
        browser = await puppeteerCore.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(CHROMIUM_PACK), // Завантажуємо браузер
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
        await new Promise(r => setTimeout(r, 1500)); // Чекаємо 1.5 сек

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

module.exports = getRouter(builder.getInterface());
