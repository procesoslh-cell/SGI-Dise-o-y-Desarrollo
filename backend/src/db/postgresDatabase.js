import pg from 'pg';

const { Pool } = pg;
const clone = (value) => JSON.parse(JSON.stringify(value));

const NORMALIZED_COLLECTIONS = {
  users: 'users',
  projects: 'projects',
  projectStages: 'project_stages',
  marketingTasks: 'marketing_tasks',
  taskProgress: 'task_progress',
  notifications: 'notifications',
  emailOutbox: 'email_outbox'
};

const normalizedKeys = Object.keys(NORMALIZED_COLLECTIONS);

function splitState(state) {
  const legacy = clone(state || {});
  const normalized = {};

  for (const key of normalizedKeys) {
    normalized[key] = Array.isArray(legacy[key]) ? legacy[key] : [];
    delete legacy[key];
  }

  return { legacy, normalized };
}

function mergeState(legacy, normalized) {
  return {
    ...clone(legacy || {}),
    ...Object.fromEntries(normalizedKeys.map((key) => [key, clone(normalized[key] || [])]))
  };
}

function entityId(item, index) {
  if (item?.id !== undefined && item?.id !== null && item?.id !== '') return String(item.id);
  return `row_${index + 1}`;
}

export class PostgresDatabase {
  constructor(pool, initialData, state) {
    this.pool = pool;
    this.initialData = initialData;
    this.state = clone(state);
    this.writeQueue = Promise.resolve();
  }

  static async connect(config, initialData) {
    const pool = new Pool(config);
    await PostgresDatabase.ensureSchema(pool);

    const existing = await pool.query('SELECT data FROM app_state WHERE id = $1', ['main']);
    if (!existing.rows.length) {
      await PostgresDatabase.seedState(pool, initialData);
    } else {
      await PostgresDatabase.bootstrapNormalizedTables(pool, existing.rows[0]?.data || {});
    }

    const state = await PostgresDatabase.loadState(pool, initialData);
    return new PostgresDatabase(pool, initialData, state);
  }

  static async ensureSchema(pool) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT,
        email TEXT,
        role_id TEXT,
        active BOOLEAN,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_uidx
        ON users (LOWER(username)) WHERE username IS NOT NULL;
      CREATE INDEX IF NOT EXISTS users_role_idx ON users (role_id);

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        code TEXT,
        name TEXT,
        status TEXT,
        owner_user_id TEXT,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);
      CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects (owner_user_id);

      CREATE TABLE IF NOT EXISTS project_stages (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        stage_id TEXT,
        responsible_user_id TEXT,
        status TEXT,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS project_stages_project_idx ON project_stages (project_id);
      CREATE INDEX IF NOT EXISTS project_stages_responsible_idx ON project_stages (responsible_user_id);
      CREATE INDEX IF NOT EXISTS project_stages_status_idx ON project_stages (status);

      CREATE TABLE IF NOT EXISTS marketing_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        responsible_user_id TEXT,
        status TEXT,
        start_date DATE,
        end_date DATE,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS marketing_tasks_project_idx ON marketing_tasks (project_id);
      CREATE INDEX IF NOT EXISTS marketing_tasks_responsible_idx ON marketing_tasks (responsible_user_id);
      CREATE INDEX IF NOT EXISTS marketing_tasks_status_idx ON marketing_tasks (status);

      CREATE TABLE IF NOT EXISTS task_progress (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        project_id TEXT,
        user_id TEXT,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS task_progress_task_idx ON task_progress (task_id);
      CREATE INDEX IF NOT EXISTS task_progress_project_idx ON task_progress (project_id);

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        role_id TEXT,
        project_id TEXT,
        type TEXT,
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id);
      CREATE INDEX IF NOT EXISTS notifications_project_idx ON notifications (project_id);
      CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id, is_read);

      CREATE TABLE IF NOT EXISTS email_outbox (
        id TEXT PRIMARY KEY,
        recipient TEXT,
        subject TEXT,
        status TEXT,
        created_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS email_outbox_status_idx ON email_outbox (status);
    `);
  }

  static async tableCount(client, table) {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    return Number(rows[0]?.count || 0);
  }

  static async bootstrapNormalizedTables(pool, storedState) {
    const hasEmbeddedCollections = normalizedKeys.some((key) => Array.isArray(storedState?.[key]));
    if (!hasEmbeddedCollections) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { legacy, normalized } = splitState(storedState);

      for (const [key, table] of Object.entries(NORMALIZED_COLLECTIONS)) {
        const count = await PostgresDatabase.tableCount(client, table);
        if (count === 0 && normalized[key]?.length) {
          await PostgresDatabase.replaceCollection(client, key, normalized[key]);
        }
      }

      await client.query(
        'UPDATE app_state SET data = $2::jsonb, updated_at = NOW() WHERE id = $1',
        ['main', JSON.stringify(legacy)]
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async seedState(pool, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { legacy, normalized } = splitState(data);

      await client.query(
        `INSERT INTO app_state (id, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        ['main', JSON.stringify(legacy)]
      );

      for (const key of normalizedKeys) {
        await PostgresDatabase.replaceCollection(client, key, normalized[key]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async loadState(pool, fallback) {
    const { rows } = await pool.query('SELECT data FROM app_state WHERE id = $1', ['main']);
    const legacy = rows[0]?.data || splitState(fallback).legacy;
    const normalized = {};

    for (const [key, table] of Object.entries(NORMALIZED_COLLECTIONS)) {
      const result = await pool.query(`SELECT payload FROM ${table} ORDER BY updated_at, id`);
      normalized[key] = result.rows.map((row) => row.payload);
    }

    return mergeState(legacy, normalized);
  }

  static rowColumns(key, item) {
    switch (key) {
      case 'users':
        return {
          columns: ['id', 'username', 'email', 'role_id', 'active', 'payload'],
          values: [item.id, item.username || null, item.email || null, item.roleId || null, item.active !== false, item]
        };
      case 'projects':
        return {
          columns: ['id', 'code', 'name', 'status', 'owner_user_id', 'payload'],
          values: [item.id, item.code || item.projectCode || null, item.name || item.title || null, item.status || null, item.ownerUserId || item.responsibleUserId || null, item]
        };
      case 'projectStages':
        return {
          columns: ['id', 'project_id', 'stage_id', 'responsible_user_id', 'status', 'payload'],
          values: [item.id, item.projectId || null, item.stageId || null, item.responsibleUserId || item.assignedUserId || null, item.status || null, item]
        };
      case 'marketingTasks':
        return {
          columns: ['id', 'project_id', 'responsible_user_id', 'status', 'start_date', 'end_date', 'payload'],
          values: [item.id, item.projectId || null, item.responsibleUserId || item.assignedUserId || null, item.status || null, item.startDate || null, item.endDate || item.dueDate || null, item]
        };
      case 'taskProgress':
        return {
          columns: ['id', 'task_id', 'project_id', 'user_id', 'payload'],
          values: [item.id, item.taskId || item.marketingTaskId || item.projectStageId || null, item.projectId || null, item.userId || item.createdBy || null, item]
        };
      case 'notifications':
        return {
          columns: ['id', 'user_id', 'role_id', 'project_id', 'type', 'is_read', 'created_at', 'payload'],
          values: [item.id, item.userId || null, item.roleId || null, item.projectId || null, item.type || null, Boolean(item.read), item.createdAt || null, item]
        };
      case 'emailOutbox':
        return {
          columns: ['id', 'recipient', 'subject', 'status', 'created_at', 'sent_at', 'payload'],
          values: [item.id, item.to || item.recipient || null, item.subject || null, item.status || null, item.createdAt || null, item.sentAt || null, item]
        };
      default:
        throw new Error(`Colección normalizada no soportada: ${key}`);
    }
  }

  static async replaceCollection(client, key, items = []) {
    const table = NORMALIZED_COLLECTIONS[key];
    await client.query(`DELETE FROM ${table}`);

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const row = PostgresDatabase.rowColumns(key, item);
      const values = [...row.values];
      values[0] = entityId(item, index);
      values[values.length - 1] = JSON.stringify(item);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO ${table} (${row.columns.join(', ')}, updated_at) VALUES (${placeholders}, NOW())`,
        values
      );
    }
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
    const snapshot = clone(this.state);
    this.writeQueue = this.writeQueue
      .then(async () => {
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          const { legacy, normalized } = splitState(snapshot);

          await client.query(
            `INSERT INTO app_state (id, data, updated_at)
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT (id)
             DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
            ['main', JSON.stringify(legacy)]
          );

          for (const key of normalizedKeys) {
            await PostgresDatabase.replaceCollection(client, key, normalized[key]);
          }

          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      })
      .catch((error) => {
        console.error('Error persistiendo estado normalizado en PostgreSQL:', error);
      });

    return this.writeQueue;
  }

  async health() {
    const { rows } = await this.pool.query(`
      SELECT
        NOW() AS database_time,
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM projects) AS projects,
        (SELECT COUNT(*)::int FROM project_stages) AS project_stages,
        (SELECT COUNT(*)::int FROM marketing_tasks) AS marketing_tasks
    `);
    return { ok: true, ...rows[0] };
  }

  async reset(data = this.initialData) {
    this.state = clone(data);
    await PostgresDatabase.seedState(this.pool, this.state);
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
