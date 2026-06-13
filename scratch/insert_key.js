const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.resolve(__dirname, '../prisma/dev.db');
console.log('Connecting to database at:', dbPath);

try {
  const db = new Database(dbPath);
  
  // Check if key already exists
  const key = process.env.GEMINI_API_KEY || 'AIzaSyMockUserApiKeyPlaceholder';
  const row = db.prepare('SELECT * FROM GeminiKey WHERE key = ?').get(key);
  
  if (row) {
    console.log('Key already exists in DB:', row);
  } else {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Insert new key
    const info = db.prepare(
      'INSERT INTO GeminiKey (id, key, status, requestsCount, successCount, failedCount, consumption, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, key, 'ACTIVE', 0, 0, 0, 0, now, now);
    
    console.log('Successfully inserted key. Row count:', info.changes);
  }
  db.close();
} catch (err) {
  console.error('Error during key insertion:', err);
}
