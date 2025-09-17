import { Pool, PoolClient } from 'pg';

import { Contact } from './types';

// Database connection pool
let pool: Pool | null = null;

// Database insertion statistics
export interface InsertionResult {
  inserted: number;
  updated: number;
  rejected: number;
  errors: string[];
}

// Initialize the connection pool
export function initializePool(): Pool {
  if (pool) {
    return pool;
  }

  // Use DATABASE_URL if available, otherwise build from individual components
  const connectionConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.PGHOST,
        port: parseInt(process.env.PGPORT || '5432'),
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        ssl: { rejectUnauthorized: false }, // Required for hosted PostgreSQL like Neon
      };

  pool = new Pool({
    ...connectionConfig,
    max: 10, // Maximum number of connections in the pool
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // Fail fast on connection issues
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return pool;
}

// Test database connectivity
export async function testConnection(): Promise<void> {
  const currentPool = pool || initializePool();

  try {
    const client = await currentPool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('Database connection test successful');
  } catch (error) {
    console.error('Database connection test failed:', error);
    throw error;
  }
}

// Close the connection pool
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connection pool closed');
  }
}

// Helper function to normalize contact data for database insertion
function normalizeContact(contact: Contact): Record<string, any> {
  return {
    name: contact.name || '',
    email: contact.email || '',
    company: contact.company || '',
    tags: contact.tags || [], // Already an array in the Contact interface
    position: contact.position || '',
    city: contact.city || '',
    state_province: contact.stateProvince || '', // Map from camelCase to snake_case
    country: contact.country || '',
    number: contact.number || null, // Optional field
    time_zone: contact.timeZone || '', // Map from camelCase to snake_case
    department: contact.department || null, // Optional field
    priority: contact.priority || 0,
    signal: contact.signal || '',
    signal_level: contact.signalLevel || '', // Already a string in the Contact interface
    compliment: contact.compliment || '',
    industry: contact.industry || '',
    links: contact.links || '',
    source: 'deep-research', // Always set to deep-research
  };
}

// Retry function with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Insert a single contact with upsert logic
async function insertSingleContact(
  client: PoolClient,
  contact: Contact,
): Promise<{ action: 'inserted' | 'updated' | 'rejected'; error?: string }> {
  const normalizedContact = normalizeContact(contact);

  // Validate required fields
  if (!normalizedContact.email || !normalizedContact.name) {
    return {
      action: 'rejected',
      error: 'Missing required fields: email or name',
    };
  }

  try {
    // Use UPSERT (INSERT ... ON CONFLICT) with email as unique key
    // Note: created_at is handled by defaultNow() in the DB schema
    const query = `
      INSERT INTO contacts (
        name, email, company, tags, position, city, state_province, country,
        number, time_zone, department, priority, signal, signal_level,
        compliment, industry, links, source
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      ON CONFLICT (email)
      DO UPDATE SET
        name = EXCLUDED.name,
        company = EXCLUDED.company,
        tags = EXCLUDED.tags,
        position = EXCLUDED.position,
        city = EXCLUDED.city,
        state_province = EXCLUDED.state_province,
        country = EXCLUDED.country,
        number = EXCLUDED.number,
        time_zone = EXCLUDED.time_zone,
        department = EXCLUDED.department,
        priority = EXCLUDED.priority,
        signal = EXCLUDED.signal,
        signal_level = EXCLUDED.signal_level,
        compliment = EXCLUDED.compliment,
        industry = EXCLUDED.industry,
        links = EXCLUDED.links,
        source = EXCLUDED.source
      RETURNING (xmax = 0) AS inserted;
    `;

    const values = [
      normalizedContact.name,
      normalizedContact.email,
      normalizedContact.company,
      normalizedContact.tags,
      normalizedContact.position,
      normalizedContact.city,
      normalizedContact.state_province,
      normalizedContact.country,
      normalizedContact.number,
      normalizedContact.time_zone,
      normalizedContact.department,
      normalizedContact.priority,
      normalizedContact.signal,
      normalizedContact.signal_level,
      normalizedContact.compliment,
      normalizedContact.industry,
      normalizedContact.links,
      normalizedContact.source,
    ];

    const result = await client.query(query, values);
    const wasInserted = result.rows[0]?.inserted;

    return { action: wasInserted ? 'inserted' : 'updated' };
  } catch (error) {
    console.error('Error inserting contact:', error);
    return {
      action: 'rejected',
      error: `Database error: ${(error as Error).message}`,
    };
  }
}

// Insert multiple contacts with batch processing
export async function insertContacts(
  contacts: Contact[],
): Promise<InsertionResult> {
  if (!contacts || contacts.length === 0) {
    return { inserted: 0, updated: 0, rejected: 0, errors: [] };
  }

  const currentPool = pool || initializePool();
  const result: InsertionResult = {
    inserted: 0,
    updated: 0,
    rejected: 0,
    errors: [],
  };

  try {
    await withRetry(async () => {
      const client = await currentPool.connect();

      try {
        // Process contacts in batches to avoid overwhelming the database
        const batchSize = 50;
        const batches = [];

        for (let i = 0; i < contacts.length; i += batchSize) {
          batches.push(contacts.slice(i, i + batchSize));
        }

        console.log(
          `Processing ${contacts.length} contacts in ${batches.length} batches`,
        );

        for (const [batchIndex, batch] of batches.entries()) {
          console.log(
            `Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} contacts)`,
          );

          // Begin transaction for each batch
          await client.query('BEGIN');

          try {
            for (const contact of batch) {
              const contactResult = await insertSingleContact(client, contact);

              switch (contactResult.action) {
                case 'inserted':
                  result.inserted++;
                  break;
                case 'updated':
                  result.updated++;
                  break;
                case 'rejected':
                  result.rejected++;
                  if (contactResult.error) {
                    result.errors.push(
                      `${contact.email}: ${contactResult.error}`,
                    );
                  }
                  break;
              }
            }

            // Commit the batch transaction
            await client.query('COMMIT');
          } catch (batchError) {
            // Rollback on batch failure
            await client.query('ROLLBACK');
            throw batchError;
          }
        }
      } finally {
        client.release();
      }
    });

    console.log(
      `Database insertion completed: ${result.inserted} inserted, ${result.updated} updated, ${result.rejected} rejected`,
    );

    if (result.errors.length > 0) {
      console.warn('Insertion errors:', result.errors);
    }

    return result;
  } catch (error) {
    const errorMessage = `Database operation failed: ${(error as Error).message}`;
    console.error(errorMessage);

    result.errors.push(errorMessage);
    return result;
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  message: string;
}> {
  try {
    await testConnection();
    return { status: 'healthy', message: 'Database connection is working' };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database connection failed: ${(error as Error).message}`,
    };
  }
}