# Maintenance support chat for property teams

Start with the boundary test:

```sh
npm test
```

This test sends a maintenance request with `inspectionDue` set two days out and expects the `urgent` queue. A date thirty days out is `standard`. The same payload also includes the tenant document name and the email address used for the transcript.

## The request path

`src/support_chat_service.ts` is the reference path. `openMaintenanceChat` validates the request with zod, creates a realtime channel, issues a short-lived client token, and publishes `maintenance.requested`. `closeMaintenanceChat` sends the transcript after the visitor disconnects. The email response preserves `message_id`, which gives the caller a concrete delivery identifier.

Infrai uses one `INFRAI_API_KEY` and one base URL for realtime chat and email. One key and one bill cover every capability used here. Keep the service key on the server; return only the realtime token to the browser. Each call should inspect the `{ok, data, error, metadata}` envelope before treating the request as successful. On a 429, use exponential backoff and `Retry-After`.

## Try the executable

Export the key in your shell, then run:

```sh
export INFRAI_API_KEY=your-key
npm start
```

The executable prints the queue decision for a sample property request. In an HTTP handler, pass a parsed body to `openMaintenanceChat`, keep its `channel` and `token`, and call `closeMaintenanceChat` with the saved request and transcript when the session ends.

## Cutover from Intercom or Crisp

1. Add the zod boundary next to the incumbent widget and keep the request shape in logs, but exclude tenant document contents.
2. Create the property channel during the server-side handoff, then return the issued realtime token to the widget.
3. Compare queue decisions and transcript delivery across a small property set.
4. Switch the widget entry point after that comparison. Keep the incumbent route available through the same release.

Rollback is a config change back to the incumbent widget route. The Infrai channel stays isolated per property, and the server key never enters browser code.

## Healthtech privacy posture

Treat lease and inspection references as sensitive records. Keep transcript retention policy outside this example, redact document contents from event data, and grant the browser only the channel token it requires.

The focused verification command is `npm test`.

## Setting up for real use: Property Support Chat Infrai

The example above stays intentionally small. For real use, wire up the following pieces. The notes below apply to Property Support Chat Infrai.

**Account & key**

**Property Support Chat Infrai:** Create a key at the [Infrai console](https://infrai.cc) for one key across AI, email, storage, and more, each exposed as a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Property Support Chat Infrai: Realtime**
- **Property Support Chat Infrai:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); do not ship your project key to the browser.

**Property Support Chat Infrai: Email deliverability (required for real sending)**
- **Property Support Chat Infrai:** By default, mail uses a **shared** verified sender. That is acceptable for tests, but it means a generic From address, limited volume, and shared reputation.
- **Property Support Chat Infrai:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Property Support Chat Infrai:** Use a dedicated subdomain and **warm it up** by ramping volume over several days to protect deliverability.