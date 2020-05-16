import Debug from 'debug'
import { DisposeBin } from './DisposeBin'
import { MessageBusGoogleCloudPubSub } from './MessageBus'
import MuxDemux from 'mux-demux/msgpack'
import msgpack from 'msgpack-js'
import net from 'net'

const debug = Debug('playwright-on-gcloud:Client')

export function establishTunnel(options: {
  log?: (format: string, ...args: any[]) => void
  spawnServer: (options: {
    publishTopic: string
    subscriptionName: string
  }) => Promise<void>
}) {
  const log = options.log || debug
  const bin = new DisposeBin()
  const channel = MessageBusGoogleCloudPubSub.prepareChannel({ log })
  bin.add('Pub-sub channel', () => channel.dispose())

  const promise = (async () => {
    const {
      incomingTopic,
      incomingSubscription,
      outgoingTopic,
      outgoingSubscription,
    } = await channel.promise
    log('Messenging channel prepared')

    const { listen, reply, getStats } = MessageBusGoogleCloudPubSub(
      outgoingTopic,
      incomingSubscription,
    )
    bin.add('Stats tracking', async () => {
      log('Google Cloud Pub/Sub Stats', getStats())
    })
    const write = (x: any) => {
      debug('>>', x)
      reply(msgpack.encode(x))
    }
    const session = MuxDemux()
    bin.add('Multiplexer', async () => session.close())
    const ready = new Promise<{ endpoint: string }>((resolve, reject) => {
      const dispose = listen((x) => {
        const data = msgpack.decode(x)
        debug('<<', data)
        if (data.command === 'tcp') {
          session.write(data.payload)
        } else if (data.command === 'ready') {
          resolve({ endpoint: data.endpoint })
        }
      })
      bin.add('Message listener', async () => dispose())
    })
    session.on('data', (payload) => write({ command: 'tcp', payload }))
    bin.add('Abort connection with server', async () =>
      write({ command: 'close' }),
    )
    await options.spawnServer({
      publishTopic: incomingTopic,
      subscriptionName: outgoingSubscription,
    })
    log('Server request spawned')

    const { endpoint } = await ready
    log('Server is ready')

    const server = net.createServer((connection) => {
      const stream = session.createStream(null)
      connection.pipe(stream).pipe(connection)
      bin.add('TCP connection stream', async () => stream.end())
      bin.add('TCP session stream', async () => connection.end())
    })
    await bin.register(
      'TCP server',
      async () => new Promise((r) => server.listen(0, 'localhost', r)),
      async () => {
        server.close()
      },
    )
    log('Tunnel is ready')
    const port = (server.address() as any).port
    return { endpoint, port }
  })()
  return {
    promise,
    dispose: () => bin.dispose(),
  }
}
