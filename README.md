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

## Set up

**Building the image on the cloud:**

```
gcloud builds submit --tag gcr.io/$GOOGLE_CLOUD_PROJECT/playwright-on-gcloud
```

**Deploying the image to the cloud:**

```
gcloud run deploy playwright-on-gcloud \
  --image gcr.io/$GOOGLE_CLOUD_PROJECT/playwright-on-gcloud \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --cpu=2 \
  --memory=2Gi \
  --concurrency=1
```

**Environment variables:**

| Name                             | Server (Cloud Run)      | Client (Running Client)     |
| -------------------------------- | ----------------------- | --------------------------- |
| `GOOGLE_APPLICATION_CREDENTIALS` | (no need)               | Point to Service Account    |
| `JWT_SECRET`                     | JWT verification secret | JWT signing secret          |
| `PLAYWRIGHT_SERVER_URL`          | (no need)               | Point to Cloud Run endpoint |

## Running

```
# .env
GOOGLE_APPLICATION_CREDENTIALS=<path/to/service-account>.json
JWT_SECRET=<secret>
PLAYWRIGHT_SERVER_URL=https://<your-domain>.a.run.app/
```

```
node -r dotenv/config example/example-with-server.js
```
