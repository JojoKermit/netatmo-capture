require('dotenv').config();
const { google } = require('googleapis');

(async () => {
  try {
    console.log('🔐 Test OAuth Google Drive...');

    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    auth.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const drive = google.drive({ version: 'v3', auth });

    const res = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name)',
    });

    console.log('✅ Connexion Drive OK');
    console.log('📁 Fichiers visibles :');
    res.data.files.forEach(f => console.log(`- ${f.name} (${f.id})`));

  } catch (err) {
    console.error('❌ ERREUR DRIVE', err.message);
  }
})();
