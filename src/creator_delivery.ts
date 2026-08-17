import { z } from "zod";
import type { InfraiSms } from "./infrai_sms.js";

export const requestCodeBody = z.object({
  assetId: z.string().min(1),
  creatorPhone: z.string().regex(/^\+[1-9]\d{7,14}$/),
}).strict();

export const verifyDeliveryBody = requestCodeBody.extend({
  code: z.string().regex(/^\d{4,8}$/),
}).strict();

export type AssetJob = {
  assetId: string;
  creatorPhone: string;
  sourceName: string;
  state: "ingested" | "processing" | "ready" | "delivered";
  renditionCount: number;
};

export class CreatorDelivery {
  private readonly jobs: Map<string, AssetJob>;
  private readonly infrai: InfraiSms;

  constructor(
    jobs: Map<string, AssetJob>,
    infrai: InfraiSms,
  ) {
    this.jobs = jobs;
    this.infrai = infrai;
  }

  async requestDeliveryCode(input: z.infer<typeof requestCodeBody>) {
    const job = this.readyJob(input.assetId, input.creatorPhone);
    const result = await this.infrai.sms.otp({
      to: input.creatorPhone,
      idempotency_key: `delivery-code:${job.assetId}`,
    });
    return { assetId: job.assetId, delivery: "code_sent" as const, requestId: result.id ?? result.message_id };
  }

  async verifyAndDeliver(input: z.infer<typeof verifyDeliveryBody>) {
    const job = this.readyJob(input.assetId, input.creatorPhone);
    const result = await this.infrai.sms.verify({
      to: input.creatorPhone,
      code: input.code,
      idempotency_key: `deliver:${job.assetId}:${input.code}`,
    });
    if (!result.verified) return { assetId: job.assetId, delivery: "locked" as const };

    job.state = "delivered";
    return {
      assetId: job.assetId,
      delivery: "released" as const,
      sourceName: job.sourceName,
      renditionCount: job.renditionCount,
    };
  }

  private readyJob(assetId: string, creatorPhone: string) {
    const job = this.jobs.get(assetId);
    if (!job || job.creatorPhone !== creatorPhone || job.state !== "ready") {
      throw new DeliveryDecisionError("Asset is not ready for this creator", 409);
    }
    return job;
  }
}

export class DeliveryDecisionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
