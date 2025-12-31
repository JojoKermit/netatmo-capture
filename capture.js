const { chromium } = require('playwright');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// --- 1. CONFIGURATION ---
const NETATMO_URL = 'https://weathermap.netatmo.com/?stationid=70:ee:50:a9:7c:b0&zoom=12.327593300918425';
const SCREENSHOT_PATH = path.join(__dirname, 'capture.png');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_DRIVE_CLIENT_ID,
  process.env.GOOGLE_DRIVE_CLIENT_SECRET
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// --- 2. LOGIQUE DE CAPTURE ---
(async () => {
    let browser;
    try {
        console.log('🌐 Ouverture du navigateur...');
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            locale: 'fr-FR',
            timezoneId: 'Europe/Paris'
        });
        const page = await context.newPage();

        console.log('📍 Chargement de Netatmo...');
        await page.goto(NETATMO_URL, { waitUntil: 'networkidle', timeout: 60000 });

        // Gestion des cookies
        try {
            const cookieBtn = page.locator('button:has-text("Accepter"), .didomi-continue-without-agreeing');
            if (await cookieBtn.count() > 0) {
                await cookieBtn.first().click();
                console.log('🍪 Cookies gérés.');
            }
        } catch (e) {}

        console.log('⏳ Attente du rendu de la carte (15s)...');
        // On attend la présence d'un canvas (Mapbox/Netatmo)
        await page.waitForSelector('canvas', { timeout: 30000 });
        
        // Pause de sécurité pour laisser les températures s'afficher
        await page.waitForTimeout(15000); 

        await page.screenshot({ path: SCREENSHOT_PATH });
        console.log('📸 Capture réalisée localement.');

        await browser.close();

        // --- 3. ENVOI VERS DRIVE ---
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `netatmo_${timestamp}.png`;
        console.log('DEBUG refresh token présent :', !!process.env.GOOGLE_REFRESH_TOKEN);

        console.log(`🚀 Upload vers Drive : ${fileName}`);
        await drive.files.create({
            requestBody: {
                name: fileName,
                parents: [process.env.GDRIVE_FOLDER_ID]
            },
            media: {
                mimeType: 'image/png',
                body: fs.createReadStream(SCREENSHOT_PATH)
            }
        });
        console.log('✅ Terminé avec succès !');

    } catch (error) {
        console.error('⚠️ Erreur :', error);
        if (browser) await browser.close();
        process.exit(1);
    }
})();
