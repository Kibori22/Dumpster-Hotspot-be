const { Pool } = require('pg');
require('dotenv').config(); // Loads variables from your .env file

// The Pool manages multiple connections so your app doesn't crash under load
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// We export an object with a 'query' method
// This allows you to run SQL commands anywhere in your app
module.exports = {
  query: (text, params) => pool.query(text, params),
};
