import { SCHEMA } from "../config";
import { checkConnection } from "../connection/db";
import { SchemaModel } from "../models/schema.model";

/** Tablas que el backend espera encontrar en el esquema agenda. */
export const EXPECTED_TABLES = ["therapists", "patients", "coordination", "sessions", "session_patients"] as const;

export const HealthService = {
      /** ¿Se llega a la base, existe el esquema agenda y están sus tablas? Solo lee. */
      async database() {
            await checkConnection();
            const schemaExists = await SchemaModel.schemaExists(SCHEMA);
            const present = schemaExists ? (await SchemaModel.tables(SCHEMA)).map((t) => t.table) : [];
            const missingTables = EXPECTED_TABLES.filter((t) => !present.includes(t));
            return { connected: true, schema: SCHEMA, schemaExists, missingTables, ready: schemaExists && missingTables.length === 0 };
      },
};
