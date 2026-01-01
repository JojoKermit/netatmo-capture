const { chromium } = require('playwright');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Chargement .env UNIQUEMENT en local
if (fs.existsSync(path.join(__dirname, '.env'))) {
  require('dotenv').config();
}

const SCREENSHOT_PATH = path.join(__dirname, 'capture.png');
const NETATMO_URL = 'https://weathermap.netatmo.com/?stationid=70:ee:50:a9:7c:b0&zoom=12.327593300918425';

const { EMAIL_USER, EMAIL_APP_PASSWORD, EMAIL_TO } = process.env;

if (!EMAIL_USER || !EMAIL_APP_PASSWORD || !EMAIL_TO) {
  console.error('❌ Variables EMAIL manquantes dans les secrets GitHub');
  process.exit(1);
}

(async () => {
  let browser;

  try {
    console.log('🌐 Ouverture du navigateur...');
    browser = await chromium.launch({ headless: true });
    // browser = await chromium.launch({ headless: false });
    // Tu verras la fenêtre s'ouvrir
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris'
    });

    const page = await context.newPage();
    
    console.log('🚀 Navigation vers la carte Netatmo...');
    // On attend que le réseau soit calme
    await page.goto(NETATMO_URL, { waitUntil: 'networkidle', timeout: 60000 });

    // --- GESTION DES COOKIES ---
    try {
      console.log('🍪 Recherche du bouton "Tout accepter"...');
      const acceptBtn = page.getByRole('button', { name: 'Tout accepter' });
      
      // On attend 10 secondes max que le bouton apparaisse
      await acceptBtn.waitFor({ state: 'visible', timeout: 10000 });
      await acceptBtn.click();
      console.log('✅ Bouton cookies cliqué.');
    } catch (e) {
      console.log('⚠️ Bouton non trouvé ou déjà disparu. Application du nettoyage CSS par sécurité.');
    }

    // --- NETTOYAGE DE L'INTERFACE ---
    // On masque de force les bandeaux de cookies et les contrôles de la carte pour une image propre
    await page.addStyleTag({
      content: `
        #didomi-host, .didomi-popup-container, .didomi-popup-backdrop, #onetrust-banner-sdk { 
          display: none !important; 
        }
        .leaflet-control-zoom, .leaflet-control-attribution, .leaflet-control-container { 
          display: none !important; 
        }
      `
    });

    // --- ATTENTE DES DONNÉES ---
    console.log('⏳ Attente du chargement des stations...');
    // On attend qu'au moins un marqueur de station météo soit visible sur la carte
    await page.waitForSelector('.station-marker', { timeout: 30000 }).catch(() => {
      console.log('Timeout: Les marqueurs ne sont pas apparus, capture forcée.');
    });

    // Petit délai supplémentaire pour que les tuiles de la carte finissent de s'afficher
    await page.waitForTimeout(5000);

    await page.screenshot({ path: SCREENSHOT_PATH });
    console.log('📸 Capture réalisée avec succès.');

    await browser.close();

    // --- ENVOI EMAIL ---
    console.log('📧 Préparation de l\'envoi de l\'email...');
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
      subject: `Capture Netatmo - ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`,
      text: 'Voici la capture automatique de la carte Netatmo.',
      attachments: [
        { filename: 'netatmo_capture.png', path: SCREENSHOT_PATH }
      ]
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé !');

  } catch (err) {
    console.error('❌ Erreur critique :', err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();