import pg from 'pg';

const { Pool } = pg;
const clone = (value) => JSON.parse(JSON.stringify(value));

export class PostgresDatabase {
  constructor(pool, initialData, state) {
    this.pool = pool;
    this.initialData = initialData;
    this.state = clone(state);
    this.writeQueue = Promise.resolve();
  }

  static async connect(config, initialData) {
    const pool = new Pool(config);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(
      `INSERT INTO app_state (id, data)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      ['main', JSON.stringify(initialData)]
    );

    const { rows } = await pool.query('SELECT data FROM app_state WHERE id = $1', ['main']);
    const state = rows[0]?.data || initialData;

    return new PostgresDatabase(pool, initialData, state);
  }

  read() {
    return clone(this.state);
  }

  write(data) {
    this.state = clone(data);
    this.persist();
  }

  transact(mutator) {
    const data = this.read();
    const result = mutator(data);
    this.state = data;
    this.persist();
    return clone(result ?? data);
  }

  persist() {
    const payload = JSON.stringify(this.state);
    this.writeQueue = this.writeQueue
      .then(() => this.pool.query(
        `UPDATE app_state
         SET data = $2::jsonb, updated_at = NOW()
         WHERE id = $1`,
        ['main', payload]
      ))
      .catch((error) => {
        console.error('Error persistiendo estado en PostgreSQL:', error);
      });

    return this.writeQueue;
  }

  async reset(data = this.initialData) {
    this.state = clone(data);
    await this.pool.query(
      `INSERT INTO app_state (id, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id)
       DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      ['main', JSON.stringify(this.state)]
    );
  }

  async flush() {
    await this.writeQueue;
  }

  async close() {
    await this.flush();
    await this.pool.end();
  }

  nextId(data, collection) {
    const items = data[collection] || [];
    return items.length ? Math.max(...items.map((x) => Number(x.id) || 0)) + 1 : 1;
  }
}
