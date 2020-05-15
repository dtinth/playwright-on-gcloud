FROM node:14

RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-unstable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY yarn.lock package.json ./
RUN env YARN_SKIP_PREPARE=1 yarn
COPY tsconfig.json ./
COPY server/package.json server/yarn.lock server/
RUN cd server && yarn
COPY server/src/ server/src/
COPY src/ src/
RUN yarn prepare
USER node
CMD node server/src/main.js
