import { query, type Queryable } from "../connection/db";

export type ColumnInfo = { name: string, type: string, nullable: boolean };
export type TableInfo = { table: string, columns: ColumnInfo[] };

/** Consultas de solo lectura sobre el catálogo de Postgres, para saber en qué estado está la base. */
export const SchemaModel = {
      async schemaExists(schema: string, db?: Queryable): Promise<boolean> {
            const rows = await query("select 1 from information_schema.schemata where schema_name = $1", [schema], db);
            return rows.length > 0;
      },

      /** Tablas de un esquema con sus columnas. */
      async tables(schema: string, db?: Queryable): Promise<TableInfo[]> {
            const rows = await query<{ table_name: string, column_name: string, data_type: string, is_nullable: "YES" | "NO" }>(
                  `select table_name, column_name, data_type, is_nullable
                   from information_schema.columns where table_schema = $1
                   order by table_name, ordinal_position`,
                  [schema], db,
            );
            const byTable = new Map<string, ColumnInfo[]>();
            for (const r of rows)
                  byTable.set(r.table_name, [...(byTable.get(r.table_name) ?? []), { name: r.column_name, type: r.data_type, nullable: r.is_nullable === "YES" }]);
            return [...byTable].map(([table, columns]) => ({ table, columns }));
      },

      /** Esquemas que no son del sistema (para ver qué más hay en la base). */
      async userSchemas(db?: Queryable): Promise<string[]> {
            const rows = await query<{ schema_name: string }>(
                  `select schema_name from information_schema.schemata
                   where schema_name not in ('pg_catalog', 'information_schema', 'pg_toast') and schema_name not like 'pg_temp%' and schema_name not like 'pg_toast_temp%'
                   order by 1`, [], db);
            return rows.map((r) => r.schema_name);
      },

      /** Filas de una tabla del esquema agenda. El nombre sale de una lista cerrada, nunca de la petición. */
      async count(table: string, db?: Queryable): Promise<number> {
            const rows = await query<{ n: number }>(`select count(*)::int as n from agenda.${quoteIdent(table)}`, [], db);
            return rows[0].n;
      },
};

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;
