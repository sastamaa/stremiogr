const { addonBuilder, getRouter } = require('stremio-addon-sdk');
const puppeteerCore = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// 1. Опис аддону для Stremio (Маніфест)
const manifest = {
    id: 'org.coverapi.stremio',
    version: '1.0.0',
    name: 'Movies',
    description: 'Дивіться фільми та серіали з грецькою озвучкою/субтитрами',
    resources: ['stream'],
    types: ['movie', 'series'],
    idPrefixes: ['tt'],
    catalogs: []
};

const builder = new addonBuilder(manifest);

// 2. Логіка парсингу відео
builder.defineStreamHandler(async (args) => {
    const imdbId = args.id.split(':')[0]; 
    const targetUrl = `https://coverapi.store/embed/${imdbId}/`;
    
    console.log(`Шукаю відео для: ${targetUrl}`);

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

        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 8000 });
        await new Promise(r => setTimeout(r, 2000));

    } catch (error) {
        console.error('Помилка парсингу:', error.message);
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }

    if (streamUrl) {
        return Promise.resolve({
            streams: [
                {
                    title: `CoverAPI`,
                    url: streamUrl 
                }
            ]
        });
    } else {
        return Promise.resolve({ streams: [] });
    }
});

// Експорт для Vercel Serverless Function
module.exports = getRouter(builder.getInterface());
