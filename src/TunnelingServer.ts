import Debug from 'debug'
import { DisposeBin } from './DisposeBin'
import { MessageBusGoogleCloudPubSub } from './MessageBus'
import MuxDemux from 'mux-demux/msgpack'
import msgpack from 'msgpack-js'
import net from 'net'

const debug = Debug('playwright-on-gcloud:Server')

export function serveRequest(
  publishTopic: string,
  subscriptionName: string,
  launchTCPService: () => Promise<{
    port: number
    endpoint: string
    close: () => Promise<void>
  }> = async () => {
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
) {
  const bin = new DisposeBin()
  const promise = (async () => {
    debug(
      'Received request with publishTopic=%s, subscriptionName=%s',
      publishTopic,
      subscriptionName,
    )
    const { listen, reply } = MessageBusGoogleCloudPubSub(
      publishTopic,
      subscriptionName,
    )
    debug('Launching chromium server')
    const service = await launchTCPService()
    bin.add('Service server', () => service.close())

    // Server-client
    await new Promise((resolve, reject) => {
      const session = MuxDemux((connection) => {
        debug('Connection created')
        var tcp = net.connect(service.port, 'localhost')
        connection.pipe(tcp).pipe(connection)
        bin.add('TCP connection stream', async () => tcp.end())
        bin.add('TCP session stream', async () => connection.end())
      })
      bin.add('Multiplexer', async () => session.close())
      const dispose = listen((x) => {
        const data = msgpack.decode(x)
        debug('<<', data)
        if (data.command === 'tcp') {
          session.write(data.payload)
        } else if (data.command === 'close') {
          resolve()
        }
      })
      const write = (x: any) => {
        debug('>>', x)
        reply(msgpack.encode(x))
      }
      bin.add('Message listener', async () => dispose())
      session.on('data', (payload) => write({ command: 'tcp', payload }))
      write({ command: 'ready', endpoint: service.endpoint })
    })
  })()
  return {
    promise,
    dispose: () => bin.dispose(),
  }
}
