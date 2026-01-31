const admin = require("firebase-admin");

/**
 * Note: Place your downloaded JSON key in the 'server' folder 
 * and rename it to 'serviceAccountKey.json'
 */
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Firestore instance for the server
const db = admin.firestore();

// Export both the admin tools and the database instance
module.exports = { admin, db };
