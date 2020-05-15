// @ts-check
const { serveRequest, establishTunnel } = require('..')
const { chromium } = require('playwright-core')
const fetch = require('node-fetch').default
const jsonwebtoken = require('jsonwebtoken')

;(async () => {
  console.log('==> Starting tunnel')
  const tunnel = establishTunnel({
    async spawnServer({ publishTopic, subscriptionName }) {
      console.log('==> Tunnel parameters received', {
        publishTopic,
        subscriptionName,
      })
      const response = fetch(process.env.PLAYWRIGHT_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jsonwebtoken.sign(
            {},
            process.env.JWT_SECRET,
          )}`,
        },
        body: JSON.stringify({
          query: `
            mutation Run($publishTopic: String!, $subscriptionName: String!) {
              runPlaywright(publishTopic: $publishTopic, subscriptionName: $subscriptionName) {
                ok
                message
              }
            }
          `,
          variables: {
            publishTopic,
            subscriptionName,
          },
        }),
      }).then((r) => r.json())
      response
        .then((v) => {
          console.log('==> Playwright session ended', v)
        })
        .catch((e) => {
          console.log('==> Playwright session error', e)
        })
        .finally(() => {
          tunnel.dispose()
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
