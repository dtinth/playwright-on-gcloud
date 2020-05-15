#!/bin/bash -e
docker build -t playwright-on-gcloud .
docker run -p 127.0.0.1:4000:4000 --rm -ti -v "$PWD/server/src:/app/server/src:ro" -v "$PWD/private:/app/private:ro" --env "DEBUG=playwright-on-gcloud:*,pw:browser*" --env-file=".env" --init playwright-on-gcloud