
const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json'); // Assuming this exists or I can use default

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault() // Try default credentials
  });
}

const db = admin.firestore();

async function checkThemes() {
  try {
    console.log('Checking brandThemes collection...');
    const snapshot = await db.collection('brandThemes').get();
    console.log(`Found ${snapshot.size} themes.`);
    snapshot.forEach(doc => {
      console.log(`Brand ID: ${doc.id}`);
      console.log('Data:', JSON.stringify(doc.data(), null, 2));
    });
  } catch (error) {
    console.error('Error checking themes:', error);
  }
}

checkThemes();
