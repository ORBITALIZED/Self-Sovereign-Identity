/**
 * Fastify application factory. Used by index.ts (server) and the tests
 * (`test/route.test.ts` etc.).
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { healthRoutes } from "./routes/health.js";
import { identityRoutes } from "./routes/identity.js";
import { credentialsRoutes } from "./routes/credentials.js";
import { zkpRoutes } from "./routes/zkp.js";
import { bridgeRoutes } from "./routes/bridge.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { registerAuth } from "./middleware/auth.js";
import { registerRequestId } from "./middleware/requestId.js";

export async function build(opts: { jwtSecret: string } = { jwtSecret: "dev" }) {
  const app = Fastify({ logger: { level: "info" } });

  // Request-id must be registered FIRST so every subsequent log line in
  // the request lifecycle can include the id.
  await registerRequestId(app);

  // Env-driven CORS allow-list. `CORS_ORIGINS` is a comma-separated string;
  // when unset/empty, we fall back to the legacy `origin: true` (reflective)
  // behaviour for dev convenience.
  const corsOriginsRaw = process.env.CORS_ORIGINS ?? "";
  const corsOrigins = corsOriginsRaw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });
  await app.register(jwt, { secret: opts.jwtSecret });

  // Register the `app.authenticate` decorator BEFORE any route that uses it,
  // otherwise `preHandler: [app.authenticate]` will throw at registration time.
  registerAuth(app);

  await app.register(swagger, {
    openapi: {
      info: { title: "SSI API Gateway", version: "0.1.0" },
      servers: [{ url: "http://localhost:8080" }],
    },
  });
  await app.register(swaggerUI, { routePrefix: "/docs" });

  // Mount routes
  await app.register(healthRoutes, { prefix: "" });
  await app.register(identityRoutes, { prefix: "/identity" });
  await app.register(credentialsRoutes, { prefix: "/credentials" });
  await app.register(zkpRoutes, { prefix: "/zkp" });
  await app.register(bridgeRoutes, { prefix: "/bridge" });

  app.setErrorHandler(errorHandler);

  return app;
}
