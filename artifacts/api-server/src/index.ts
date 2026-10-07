import app from "./app";
import { seedLoanCatalog } from "@workspace/db/seed";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer(): Promise<void> {
  try {
    // Idempotent data seeding only; schema changes are managed by Drizzle.
    await seedLoanCatalog();
  } catch (error) {
    logger.error({ err: error }, "Could not initialize the loan catalogue");
    process.exit(1);
    return;
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void startServer();
