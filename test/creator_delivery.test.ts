import assert from "node:assert/strict";
import test from "node:test";
import { CreatorDelivery, type AssetJob } from "../src/creator_delivery.js";
import type { InfraiSms } from "../src/infrai_sms.js";

test("a verified creator releases every processed rendition", async () => {
  const asset: AssetJob = {
    assetId: "asset_7",
    creatorPhone: "+15555550101",
    sourceName: "pilot.mov",
    state: "ready",
    renditionCount: 3,
  };
  const calls: string[] = [];
  const infrai: InfraiSms = {
    sms: {
      otp: async ({ to }) => { calls.push(`send:${to}`); return { id: "otp_7" }; },
      verify: async ({ to, code }) => { calls.push(`verify:${to}:${code}`); return { verified: true }; },
    },
  };
  const delivery = new CreatorDelivery(new Map([[asset.assetId, asset]]), infrai);

  const sent = await delivery.requestDeliveryCode({ assetId: asset.assetId, creatorPhone: asset.creatorPhone });
  const released = await delivery.verifyAndDeliver({ assetId: asset.assetId, creatorPhone: asset.creatorPhone, code: "814206" });

  assert.deepEqual(sent, { assetId: "asset_7", delivery: "code_sent", requestId: "otp_7" });
  assert.deepEqual(released, { assetId: "asset_7", delivery: "released", sourceName: "pilot.mov", renditionCount: 3 });
  assert.equal(asset.state, "delivered");
  assert.deepEqual(calls, ["send:+15555550101", "verify:+15555550101:814206"]);
});

test("an unverified code keeps the creator delivery locked", async () => {
  const asset: AssetJob = {
    assetId: "asset_8",
    creatorPhone: "+15555550102",
    sourceName: "trailer.mov",
    state: "ready",
    renditionCount: 2,
  };
  const infrai: InfraiSms = {
    sms: {
      otp: async () => ({ id: "otp_8" }),
      verify: async () => ({ verified: false }),
    },
  };

  const result = await new CreatorDelivery(new Map([[asset.assetId, asset]]), infrai)
    .verifyAndDeliver({ assetId: asset.assetId, creatorPhone: asset.creatorPhone, code: "111111" });

  assert.deepEqual(result, { assetId: "asset_8", delivery: "locked" });
  assert.equal(asset.state, "ready");
});
