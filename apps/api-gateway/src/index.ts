/**
 * Server entry — boots the Fastify app and listens on $PORT (default 8080).
 */

import { build } from "./app.js";

const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "0.0.0.0";

// Hard-fail on missing JWT_SECRET so prod can't silently use a default.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET is required in production");
}
const SECRET = process.env.JWT_SECRET ?? "dev-only-secret-replace-me";

const app = await build({ jwtSecret: SECRET });

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`SSI API gateway listening on http://${HOST}:${PORT}`);
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
