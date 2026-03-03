const { builder, getRouter } = require('stremio-addon-sdk');
const puppeteerCore = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

// 1. Опис аддону для Stremio (Маніфест)
const manifest = {
    id: 'org.coverapi.stremio',
    version: '1.0.0',
    name: 'Greek Movies',
    description: 'Watch movies and series',
    resources: ['stream'], // Ми віддаємо тільки відео (стріми)
    types: ['movie', 'series'],
    idPrefixes: ['tt'], // Аддон реагує тільки на IMDb ID
    catalogs: []
};

const addon = new builder(manifest);

// 2. Логіка парсингу відео
addon.defineStreamHandler(async (args) => {
    // args.id містить ID зі Stremio (наприклад: "tt14181714" або "tt14181714:1:2" для серіалів)
    // Витягуємо чистий IMDb ID (до першої двокрапки, якщо це серіал)
    const imdbId = args.id.split(':')[0]; 
    const targetUrl = `https://coverapi.store/embed/${imdbId}/`;
    
    console.log(`Шукаю відео для: ${targetUrl}`);

    let browser = null;
    let streamUrl = null;

    try {
        // Запуск легкого браузера для Vercel
        browser = await puppeteerCore.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        
        // Перехоплюємо всі запити сторінки
        await page.setRequestInterception(true);
        
        page.on('request', (request) => {
            const url = request.url();
            // Якщо браузер сайту намагається завантажити відеофайл - ми його "крадемо"
            if (url.includes('.m3u8') || url.includes('.mp4')) {
                if (!url.includes('ad_') && !url.includes('blank')) { // Відкидаємо рекламу
                    streamUrl = url;
                }
            }
            // Продовжуємо звичайне завантаження сторінки
            request.continue();
        });

        // Заходимо на сторінку і чекаємо максимум 8 секунд
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 8000 });
        
        // Чекаємо трохи, щоб скрипти сайту встигли згенерувати m3u8
        await new Promise(r => setTimeout(r, 2000));

    } catch (error) {
        console.error('Помилка парсингу:', error.message);
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }

    // 3. Відправляємо результат у плеєр Stremio
    if (streamUrl) {
        console.log(`Знайдено відео: ${streamUrl}`);
        return Promise.resolve({
            streams: [
                {
                    title: `CoverAPI (Грецька)`,
                    url: streamUrl // Пряме посилання на відео
                }
            ]
        });
    } else {
        // Якщо нічого не знайдено - віддаємо порожній список
        console.log('Відео не знайдено');
        return Promise.resolve({ streams: [] });
    }
});

// Експорт для Vercel Serverless Function
module.exports = getRouter(addon.getInterface());
