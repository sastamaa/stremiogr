const { addonBuilder, getRouter } = require('stremio-addon-sdk');
const puppeteerCore = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const express = require('express');

const manifest = {
    id: 'org.coverapi.stremio',
    version: '1.0.2',
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

    try {
        browser = await puppeteerCore.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(), 
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setRequestInterception(true);
        
        page.on('request', (request) => {
            const url = request.url();
            
            if (url.includes('.m3u8') || url.includes('.mp4')) {
                if (!url.includes('ad_') && !url.includes('blank') && !url.includes('google')) { 
                    streamUrl = url;
                    console.log(`[SUCCESS] Знайдено відео: ${streamUrl}`);
                }
            }
            request.continue();
        });

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await new Promise(r => setTimeout(r, 2000));

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

// Створюємо сервер Express спеціально для Vercel
const app = express();
const addonRouter = getRouter(builder.getInterface());

app.use('/', addonRouter);

module.exports = app;
