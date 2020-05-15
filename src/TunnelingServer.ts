import Debug from 'debug'
import { DisposeBin } from './DisposeBin'
import { MessageBusGoogleCloudPubSub } from './MessageBus'
import MuxDemux from 'mux-demux/msgpack'
import msgpack from 'msgpack-js'
import net from 'net'

const debug = Debug('playwright-on-gcloud:Server')

export function serveRequest(options: {
  publishTopic: string
  subscriptionName: string
  launchTCPService: () => Promise<{
    port: number
    endpoint: string
    close: () => Promise<void>
  }>
}) {
  const bin = new DisposeBin()
  const sessionEndPromise = (async () => {
    debug(
      'Received request with publishTopic=%s, subscriptionName=%s',
      options.publishTopic,
      options.subscriptionName,
    )
    const { listen, reply } = MessageBusGoogleCloudPubSub(
      options.publishTopic,
      options.subscriptionName,
    )
    debug('Launching chromium server')
    const service = await options.launchTCPService()
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
  sessionEndPromise.then(() => bin.dispose())
  return {
    sessionEndPromise,
    dispose: () => bin.dispose(),
  }
}
