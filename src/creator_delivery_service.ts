import express from "express";
import { ZodError } from "zod";
import { CreatorDelivery, DeliveryDecisionError, requestCodeBody, verifyDeliveryBody, type AssetJob } from "./creator_delivery.js";
import { createInfraiSms, InfraiError } from "./infrai_sms.js";

const jobs = new Map<string, AssetJob>([
  ["asset_demo_42", {
    assetId: "asset_demo_42",
    creatorPhone: process.env.DEMO_CREATOR_PHONE ?? "+15555550123",
    sourceName: "festival-cut.mov",
    state: "ready",
    renditionCount: 4,
  }],
]);

export function buildService(delivery: CreatorDelivery) {
  const app = express();
  app.use(express.json());

  app.post("/creator-deliveries/code", async (request, response, next) => {
    try {
      response.status(202).json(await delivery.requestDeliveryCode(requestCodeBody.parse(request.body)));
    } catch (error) {
      next(error);
    }
  });

  app.post("/creator-deliveries/verify", async (request, response, next) => {
    try {
      response.json(await delivery.verifyAndDeliver(verifyDeliveryBody.parse(request.body)));
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) return response.status(400).json({ error: "invalid_request", issues: error.issues });
    if (error instanceof DeliveryDecisionError) return response.status(error.status).json({ error: error.message });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return response.status(status).json({ error: error.code, message: error.message });
    }
    return response.status(500).json({ error: "internal_error" });
  });
  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  buildService(new CreatorDelivery(jobs, createInfraiSms())).listen(port, () => {
    console.log(`Creator delivery service listening on http://localhost:${port}`);
  });
}
