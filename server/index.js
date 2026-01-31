const express = require('express');
const app = express();

// IMPORT YOUR CONFIGS
const db = require('./config/db'); // PostgreSQL
const { firebaseDb } = require('./config/firebase'); // Firebase

app.use(express.json());

// Example: Get all users from PostgreSQL
app.get('/users', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).send("Database error");
  }
});

app.listen(5000, () => console.log("Server is organized and running! 🚀"));
