/**
 * IPFS service entry. Boots Fastify + registers routes.
 */

import Fastify from "fastify";
import { pinRoutes } from "./services/pin.js";

const app = Fastify({ logger: true });

await app.register(pinRoutes, { prefix: "" });

const PORT = Number(process.env.PORT ?? 7000);
app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => {
    app.log.info(`SSI IPFS service on http://0.0.0.0:${PORT}`);
  })
  .catch((e) => {
    app.log.error(e);
    process.exit(1);
  });
