# playwright-on-gcloud

An experiment to expose Playwright as a service on Google Cloud.

## Principles

- Use only Google Cloud’s services.

- No running virtual machines. Everything must be pay-as-you-go.

## Motivation and ideas

- [Playwright 1.0 released](https://github.com/microsoft/playwright/releases/tag/v1.0.0).

- It has [browserType.launchServer()](https://github.com/microsoft/playwright/blob/v1.0.0/docs/api.md#browsertypelaunchserveroptions) which can launch a WebSocket server that clients can connect to.

- [Google Cloud Run](https://cloud.google.com/run) allows hundreds of containers to be run simultaneously. This could potentially allow us to run tests (and other browser automation tasks) with extreme parallelism.

- However, [it does not support inbound WebSockets or streaming gRPC](https://web.archive.org/web/20200117173740/https://cloud.google.com/run/docs/issues).

- But outbound streaming is fine. (It can connect to WebSockets and stuff, like SSH.) That means we can multiplex TCP streams over other real-time bidirectional communication mechanisms that Google Cloud provides. The [mux-demux](https://www.npmjs.com/package/mux-demux) npm library is used.

- Services that we could potentially use include: [Cloud Pub/Sub](https://cloud.google.com/pubsub), [Firebase Realtime Database](https://firebase.google.com/products/realtime-database), [Firebase Cloud Firestore](https://firebase.google.com/products/firestore)

## Notes

- This is still an unfinished prototype. Expect to see 💩 code.
