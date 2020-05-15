// @ts-check
const { serveRequest, establishTunnel } = require('..')
const { chromium } = require('playwright-core')

;(async () => {
  console.log('==> Starting tunnel')
  const tunnel = establishTunnel({
    async spawnServer({ publishTopic, subscriptionName }) {
      console.log('==> Tunnel parameters received', {
        publishTopic,
        subscriptionName,
      })
      const { sessionEndPromise } = serveRequest({
        publishTopic,
        subscriptionName,
        async launchTCPService() {
          console.log('==> Launching Playwright')
          const { chromium } = require('playwright')
          const browserServer = await chromium.launchServer()
          const wsEndpoint = browserServer.wsEndpoint()
          const [, port, endpoint] = wsEndpoint.match(/:(\d+)(\/.*$)/)
          return {
            port: +port,
            endpoint: endpoint,
            close: () => browserServer.close(),
          }
        },
      })
      sessionEndPromise.then(() => {
        console.log('==> Playwright session ended')
      })
    },
  })
  process.once('SIGINT', () => tunnel.dispose())
  try {
    const { endpoint, port } = await tunnel.promise
    console.log('==> Tunnel ready', {
      endpoint,
      port,
    })

    const wsEndpoint = `ws://localhost:${port}${endpoint}`
    console.log('==> Connect to ' + wsEndpoint)
    const browser = await chromium.connect({
      wsEndpoint: wsEndpoint,
    })
    try {
      console.log('==> Chromium connected')
      const context = await browser.newContext({})
      console.log('==> Context created')
      const page = await context.newPage()
      console.log('==> Page created')
      await page.goto('http://example.com')
      console.log('==> Navigated')
      console.log(await page.title())
    } finally {
      await browser.close().catch((e) => {
        console.error('Cannot close browser', e)
      })
    }
  } finally {
    tunnel.dispose()
  }
})()
