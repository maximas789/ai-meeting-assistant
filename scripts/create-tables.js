require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

async function createTables() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  try {
    console.log('Creating tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255),
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMP,
        transcript TEXT,
        summary TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS action_items (
        id SERIAL PRIMARY KEY,
        meeting_id INTEGER REFERENCES meetings(id) ON DELETE CASCADE,
        assignee VARCHAR(255),
        task TEXT NOT NULL,
        due_date TIMESTAMP,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        mime_type VARCHAR(100),
        file_size INTEGER,
        chromadb_collection_id VARCHAR(255),
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP,
        chunk_count INTEGER
      )
    `);

    // Create indexes
    await client.query(`CREATE INDEX IF NOT EXISTS meetings_started_at_idx ON meetings(started_at)`);
    await client.query(`CREATE INDEX IF NOT EXISTS action_items_meeting_id_idx ON action_items(meeting_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS action_items_completed_idx ON action_items(completed)`);
    await client.query(`CREATE INDEX IF NOT EXISTS documents_uploaded_at_idx ON documents(uploaded_at)`);

    console.log('Tables created successfully!');
  } finally {
    client.release();
    await pool.end();
  }
}

createTables().catch(console.error);
