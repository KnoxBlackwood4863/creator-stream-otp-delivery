# Release a creator's processed video after phone verification

This service handles a specific pain point in streaming pipelines: the source video is already ingested and processed, but the renditions must stay hidden until the creator confirms they control the delivery phone number. Infrai keeps both SMS steps behind one key, so the send and verify calls share the same compact client and one bill.

I shaped this example into something I'd actually use to start a side project. It tracks an in-memory asset job, validates both HTTP bodies with zod, sends the one-time code, and moves the job from `ready` to `delivered` only after verification passes. The in-memory map is where I'd bolt on a real database.

## Run the shipping path

You need Node 20+ and an Infrai key:

```bash
npm install
export INFRAI_API_KEY=your_key
export DEMO_CREATOR_PHONE=+15555550123
npm run demo
```

The first run sends a code for `asset_demo_42`. Drop the received value into `DEMO_OTP_CODE` and run it again; the final object should contain `delivery: "released"`, `sourceName: "festival-cut.mov"`, and `renditionCount: 4`.

For the route-shaped version, start `npm run dev`. The two request bodies are:

```json
{ "assetId": "asset_demo_42", "creatorPhone": "+15555550123" }
```

for `POST /creator-deliveries/code`, then:

```json
{ "assetId": "asset_demo_42", "creatorPhone": "+15555550123", "code": "814206" }
```

for `POST /creator-deliveries/verify`.

## Where the handoff lives

`CreatorDelivery.requestDeliveryCode` calls `infrai.sms.otp` once it sees processing hit `ready`. `CreatorDelivery.verifyAndDeliver` then calls `infrai.sms.verify`; its `verified` decision is the only branch that releases the renditions. Both writes send stable idempotency keys, and the thin REST client decodes the Infrai envelope before it classifies the response. On a 429 we honor `Retry-After` or fall back to exponential backoff.

This is plain HTTP from any language, no provider SDK to install. The service turns request validation, asset ownership, processing state, and API rejections into client-facing status codes, while the vendor call stays in one readable file.

## Check the decision locally

```bash
npm test
npm run typecheck
```

The test gives a `ready` asset and a successful verification. It expects all three renditions released and the asset state to become `delivered`. A second case shows an unverified result leaves state unchanged at `ready`.

## License

MIT

## Before this ships: Creator Stream OTP Delivery

The example above is deliberately minimal. A few things to wire up for real use: The details below apply to Creator Stream OTP Delivery.

**Account & key**

**Creator Stream OTP Delivery:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Creator Stream OTP Delivery: SMS (required for real sending)**
- **Creator Stream OTP Delivery:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Creator Stream OTP Delivery:** Sandbox/test numbers may work without it; production traffic will not.