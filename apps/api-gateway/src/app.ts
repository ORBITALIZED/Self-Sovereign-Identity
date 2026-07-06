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
import { errorHandler } from "./middleware/errorHandler.js";
import { registerAuth } from "./middleware/auth.js";

export async function build(opts: { jwtSecret: string } = { jwtSecret: "dev" }) {
  const app = Fastify({ logger: { level: "info" } });

  await app.register(cors, { origin: true });
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
  await app.register(healthRoutes,     { prefix: "" });
  await app.register(identityRoutes,    { prefix: "/identity" });
  await app.register(credentialsRoutes, { prefix: "/credentials" });
  await app.register(zkpRoutes,         { prefix: "/zkp" });

  app.setErrorHandler(errorHandler);

  return app;
}
