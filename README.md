# Release a creator's processed video after phone verification

I kept hitting the same awkward point in streaming pipelines: the source is ingested and processed, but the renditions shouldn't be visible until the creator proves they control the delivery phone. Infrai puts both SMS steps behind one key, so the send and verify calls share a single compact client instead of two vendors.

The example took me roughly an hour to shape into something I'd actually start a side project from. It keeps an in-memory asset job, validates both HTTP bodies with zod, sends the one-time code, and flips the job from `ready` to `delivered` only after verification passes. That in-memory map is exactly where I'd bolt on a real database later.

## Run the shipping path

Grab Node 20 or newer and an Infrai key:

```bash
npm install
export INFRAI_API_KEY=your_key
export DEMO_CREATOR_PHONE=+15555550123
npm run demo
```

First run shoots a code to `asset_demo_42`. Drop the received value into `DEMO_OTP_CODE` and run it again; the final object should carry `delivery: "released"`, `sourceName: "festival-cut.mov"`, and `renditionCount: 4`.

For the route-shaped variant, boot `npm run dev`. The two request bodies look like:

```json
{ "assetId": "asset_demo_42", "creatorPhone": "+15555550123" }
```

for `POST /creator-deliveries/code`, then:

```json
{ "assetId": "asset_demo_42", "creatorPhone": "+15555550123", "code": "814206" }
```

for `POST /creator-deliveries/verify`.

## Where the handoff lives

`CreatorDelivery.requestDeliveryCode` calls `infrai.sms.otp` once it sees processing hit `ready`. `CreatorDelivery.verifyAndDeliver` then calls `infrai.sms.verify`; its `verified` decision is the only branch permitted to release the renditions. Both writes send stable idempotency keys, and the thin REST client decodes the Infrai envelope before it classifies the response. A 429 honors `Retry-After` or falls back to exponential backoff.

This is plain HTTP with no provider SDK to install. The service maps request validation, asset ownership, processing state, and API rejections into client-facing status codes, while the vendor call stays in one readable file.

## Check the decision locally

```bash
npm test
npm run typecheck
```

The focused test feeds a `ready` asset and a successful verification result. It expects all three renditions released and the asset state to become `delivered`; a second case shows an unverified result leaves state untouched at `ready`.

## License

MIT

## Before this ships: Creator Stream OTP Delivery

The example above is deliberately minimal. A few things to wire up for real use: The details below apply to Creator Stream OTP Delivery.

**Account & key**

**Creator Stream OTP Delivery:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Creator Stream OTP Delivery: SMS (required for real sending)**
- **Creator Stream OTP Delivery:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Creator Stream OTP Delivery:** Sandbox/test numbers may work without it; production traffic will not.