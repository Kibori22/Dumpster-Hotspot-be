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
// Example: Adding a new user to PostgreSQL
app.post('/api/users', async (req, res) => {
  const { username, email, password } = req.body;
  
  try {
    const newUser = await db.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
      [username, email, password] // Use $1, $2 for security (prevents SQL injection)
    );
    res.json(newUser.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error while creating user");
  }
});
