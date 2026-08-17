import { CreatorDelivery, type AssetJob } from "../src/creator_delivery.js";
import { createInfraiSms } from "../src/infrai_sms.js";

const creatorPhone = process.env.DEMO_CREATOR_PHONE;
if (!creatorPhone) throw new Error("DEMO_CREATOR_PHONE is required");

const asset: AssetJob = {
  assetId: "asset_demo_42",
  creatorPhone,
  sourceName: "festival-cut.mov",
  state: "ready",
  renditionCount: 4,
};
const delivery = new CreatorDelivery(new Map([[asset.assetId, asset]]), createInfraiSms());
const sent = await delivery.requestDeliveryCode({ assetId: asset.assetId, creatorPhone });
console.log(sent);

const code = process.env.DEMO_OTP_CODE;
if (code) console.log(await delivery.verifyAndDeliver({ assetId: asset.assetId, creatorPhone, code }));
else console.log("Code sent. Set DEMO_OTP_CODE and run again to verify delivery.");
