// envoi_mail.js
const { chromium } = require('playwright');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Chargement .env UNIQUEMENT en local
if (fs.existsSync(path.join(__dirname, '.env'))) {
  require('dotenv').config();
}

const SCREENSHOT_PATH = path.join(__dirname, 'capture.png');
const NETATMO_URL =
  'https://weathermap.netatmo.com/?stationid=70:ee:50:a9:7c:b0&zoom=12.327593300918425';

// Vérification des variables essentielles
const {
  EMAIL_USER,
  EMAIL_APP_PASSWORD,
  EMAIL_TO
} = process.env;

if (!EMAIL_USER || !EMAIL_APP_PASSWORD || !EMAIL_TO) {
  console.error('❌ Variables EMAIL manquantes');
  process.exit(1);
}

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
    await page.goto(NETATMO_URL, { waitUntil: 'networkidle', timeout: 60000 });

    // Cookies
    try {
      const acceptBtn = page.locator(
        'button:has-text("Accepter"), button:has-text("Autoriser"), .didomi-continue-without-agreeing'
      );
      if (await acceptBtn.isVisible()) {
        await acceptBtn.click();
        console.log('🍪 Cookies gérés.');
      }
    } catch {}

    console.log('⏳ Attente du rendu de la carte (15s)...');
    await page.waitForTimeout(15000);

    await page.screenshot({ path: SCREENSHOT_PATH });
    console.log('📸 Capture réalisée localement.');

    await browser.close();

    // --- Envoi email ---
    console.log('🚀 Envoi par email...');
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_APP_PASSWORD
      }
    });

    const mailOptions = {
      from: EMAIL_USER,
      to: EMAIL_TO,
      subject: `Capture Netatmo - ${new Date().toLocaleString('fr-FR')}`,
      text: 'Voici la dernière capture Netatmo.',
      attachments: [
        { filename: 'netatmo.png', path: SCREENSHOT_PATH }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Mail envoyé avec succès.');

  } catch (err) {
    console.error('❌ Erreur :', err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
