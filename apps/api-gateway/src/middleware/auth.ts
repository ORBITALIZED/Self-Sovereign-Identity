import type { FastifyInstance, FastifyRequest } from "fastify";

/**
 * Augments Fastify instances with an `authenticate` decorator that
 * verifies a Bearer JWT. Routes that require auth use
 *   { preHandler: [app.authenticate] }
 */
declare module "fastify" {
  interface FastifyInstance {
    authenticate(req: FastifyRequest): Promise<void>;
  }
}

export function registerAuth(app: FastifyInstance) {
  app.decorate("authenticate", async (req: FastifyRequest) => {
    try {
      await req.jwtVerify();
    } catch (e) {
      throw new Error("unauthenticated");
    }
  });
}
