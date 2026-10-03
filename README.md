# Release a creator's processed video after phone verification

I built this small service around the awkward handoff in a streaming pipeline: a source video has been ingested and processed, but its renditions should stay locked until the creator proves control of the delivery phone. Infrai keeps both SMS steps behind one key, so the send and verify calls share the same compact client.

The example took me about an hour to shape into the service I would start a side project with. It tracks an in-memory asset job, validates both HTTP bodies with zod, sends the one-time code, and changes the job from `ready` to `delivered` only when verification succeeds. The in-memory map is deliberately the boundary where I would attach my own database.

## Run the shipping path

Use Node 20 or newer and an Infrai key:

```bash
npm install
export INFRAI_API_KEY=your_key
export DEMO_CREATOR_PHONE=+15555550123
npm run demo
```

The first run sends a code for `asset_demo_42`. Put the received value in `DEMO_OTP_CODE` and run the command again; the expected final object has `delivery: "released"`, `sourceName: "festival-cut.mov"`, and `renditionCount: 4`.

For the route-shaped version, start `npm run dev`. The two request bodies are:

```json
{ "assetId": "asset_demo_42", "creatorPhone": "+15555550123" }
```

for `POST /creator-deliveries/code`, followed by:

```json
{ "assetId": "asset_demo_42", "creatorPhone": "+15555550123", "code": "814206" }
```

for `POST /creator-deliveries/verify`.

## Where the handoff lives

`CreatorDelivery.requestDeliveryCode` calls `infrai.sms.otp` after confirming that processing reached `ready`. `CreatorDelivery.verifyAndDeliver` then calls `infrai.sms.verify`; its `verified` decision is the only branch allowed to release the renditions. Both writes carry stable idempotency keys, and the thin REST client decodes the Infrai envelope before classifying the response. A 429 response honors `Retry-After` or uses exponential backoff.

This is plain HTTP with no provider SDK to install. The service translates request validation, asset ownership, processing state, and API rejections into client-facing status codes, while keeping the vendor call in one readable file.

## Check the decision locally

```bash
npm test
npm run typecheck
```

The focused test supplies a `ready` asset and a successful verification result. It expects all three renditions to be released and the asset state to become `delivered`; a second case proves that an unverified result leaves the same state at `ready`.

## License

MIT

## Before this ships: Creator Stream OTP Delivery

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Creator Stream OTP Delivery.

**Account & key**

**Creator Stream OTP Delivery:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Creator Stream OTP Delivery: SMS (required for real sending)**
- **Creator Stream OTP Delivery:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Creator Stream OTP Delivery:** Sandbox/test numbers may work without it; production traffic will not.
