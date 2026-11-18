import { closePool } from "../connection/db";

/** Envuelve un script de db/: muestra el error como mensaje (sin stack) y siempre cierra las conexiones. */
export async function runCli(main: () => Promise<void>): Promise<void> {
      try {
            await main();
      } catch (error) {
            console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
            process.exitCode = 1;
      } finally {
            await closePool();
      }
}
