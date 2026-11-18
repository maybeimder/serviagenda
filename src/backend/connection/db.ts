import pg from "pg";
import { buildPoolConfig } from "../config";

/**
 * Pool de conexiones, creado de forma perezosa: el servidor puede arrancar y responder /health
 * aunque la configuración de la base esté incompleta; el error aparece al primer uso.
 */
let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
      if (!pool) {
            pool = new pg.Pool(buildPoolConfig());
            // Un error en una conexión ociosa no debe tumbar el proceso
            pool.on("error", (err) => console.error("[db] error en conexión ociosa:", err.message));
      }
      return pool;
}

/** Algo contra lo que se pueden hacer consultas: el pool o un cliente dentro de una transacción. */
export type Queryable = Pick<pg.Pool | pg.PoolClient, "query">;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
      sql: string, params: unknown[] = [], db: Queryable = getPool(),
): Promise<T[]> {
      const result = await db.query<T>(sql, params);
      return result.rows;
}

/** Ejecuta `work` dentro de una transacción: COMMIT si termina bien, ROLLBACK si lanza. */
export async function withTransaction<T>(work: (tx: pg.PoolClient) => Promise<T>): Promise<T> {
      const client = await getPool().connect();
      try {
            await client.query("BEGIN");
            const result = await work(client);
            await client.query("COMMIT");
            return result;
      } catch (error) {
            await client.query("ROLLBACK").catch(() => undefined);
            throw error;
      } finally {
            client.release();
      }
}

/** Transacción de solo lectura: cualquier escritura falla. Para inspeccionar sin riesgo. */
export async function withReadOnly<T>(work: (tx: pg.PoolClient) => Promise<T>): Promise<T> {
      const client = await getPool().connect();
      try {
            await client.query("BEGIN READ ONLY");
            return await work(client);
      } finally {
            await client.query("ROLLBACK").catch(() => undefined);
            client.release();
      }
}

export async function checkConnection(): Promise<void> {
      await getPool().query("select 1");
}

export async function closePool(): Promise<void> {
      if (pool) { await pool.end(); pool = null; }
}
