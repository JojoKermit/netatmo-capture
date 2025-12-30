const { chromium } = require('playwright');
const { google } = require('googleapis');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 }
  });

  const url = 'https://weathermap.netatmo.com/?stationid=70:ee:50:a9:7c:b0&zoom=12.327593300918425';

  // Ouvrir la page et attendre que tout charge
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000); // attendre 6 secondes pour charger la carte

  // Nom du fichier PNG horodaté
  const filename = `netatmo_${new Date().toISOString().replace(/:/g, '-')}.png`;

  // Capture de la page entière
  await page.screenshot({ path: filename, fullPage: true });
  await browser.close();

  // --- Google Drive ---
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GDRIVE_CREDENTIALS),
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });

  const drive = google.drive({ version: 'v3', auth });

  await drive.files.create({
    requestBody: {
      name: filename,
      parents: [process.env.GDRIVE_FOLDER_ID]
    },
    media: {
      mimeType: 'image/png',
      body: fs.createReadStream(filename)
    }
  });

})();
