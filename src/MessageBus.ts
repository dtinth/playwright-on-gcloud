import Debug from 'debug'
import { PubSub } from '@google-cloud/pubsub'
import { DisposeBin } from './DisposeBin'
import ObjectID from 'bson-objectid'

const debug = Debug('playwright-on-gcloud:MessageBus')

export function MessageBusGoogleCloudPubSub(
  publishTopic: string,
  subscriptionName: string,
) {
  debug('GoogleCloudPubSub(%s, %s)', publishTopic, subscriptionName)
  const pubSubClient = new PubSub()
  const topic = pubSubClient.topic(publishTopic)
  let nextId = 1

  return {
    listen(f: (buffer: Buffer) => void): () => void {
      const subscription = pubSubClient.subscription(subscriptionName)
      const receive = chaosToOrder((x: Buffer) => f(x))
      const messageHandler = (message: {
        ack: () => void
        attributes: { sequenceId: string }
        data: Buffer
      }) => {
        message.ack()
        receive(+message.attributes.sequenceId, message.data)
      }
      subscription.on('message', messageHandler)
      subscription.on('error', (e) => {
        console.error('Subscription received an error', e)
      })
      return () => {
        subscription.removeListener('message', messageHandler)
        subscription.close().catch((e) => {
          console.error('Cannot close subscription', e)
        })
      }
    },
    reply(buffer: Buffer) {
      topic.publish(buffer, { sequenceId: String(nextId++) }).catch((e) => {
        console.error('Cannot publish', e)
      })
    },
  }
}

MessageBusGoogleCloudPubSub.prepareChannel = () => {
  const bin = new DisposeBin()
  const topicNamePrefix = `playwright-${ObjectID.generate()}`
  const pubsub = new PubSub()
  const promise = (async () => {
    debug('Topic name prefix: %s', topicNamePrefix)

    const [incomingTopic] = await bin.register(
      'Incoming topic',
      async () => pubsub.createTopic(`${topicNamePrefix}-incoming`),
      async ([x]) => {
        await x.delete()
      },
    )
    debug('Created topic "%s"', incomingTopic.name)

    incomingTopic.setMetadata({
      labels: { expires: String(Date.now() + 86400e3) },
    })

    const [incomingSubscription] = await bin.register(
      'Incoming subscription',
      async () =>
        pubsub.createSubscription(incomingTopic, `${topicNamePrefix}-incoming`),
      async ([x]) => {
        await x.delete()
      },
    )
    debug('Created subscription "%s"', incomingSubscription.name)

    const [outgoingTopic] = await bin.register(
      'Outgoing topic',
      async () => pubsub.createTopic(`${topicNamePrefix}-outgoing`),
      async ([x]) => {
        await x.delete()
      },
    )
    debug('Created topic "%s"', outgoingTopic.name)
    outgoingTopic.setMetadata({
      labels: { expires: String(Date.now() + 86400e3) },
    })

    const [outgoingSubscription] = await bin.register(
      'Outgoing subscription',
      async () =>
        pubsub.createSubscription(outgoingTopic, `${topicNamePrefix}-outgoing`),
      async ([x]) => {
        await x.delete()
      },
    )
    debug('Created subscription "%s"', outgoingSubscription.name)

    return {
      incomingTopic: incomingTopic.name.split('/').pop()!,
      incomingSubscription: incomingSubscription.name.split('/').pop()!,
      outgoingTopic: outgoingTopic.name.split('/').pop()!,
      outgoingSubscription: outgoingSubscription.name.split('/').pop()!,
    }
  })()
  return { promise, dispose: () => bin.dispose() }
}

function chaosToOrder(fn: (x: Buffer) => void, first = 1) {
  const map = new Map<number, Buffer>()
  let next = first
  return (seq: number, data: Buffer) => {
    map.set(seq, data)
    while (map.has(next)) {
      const data = map.get(next)!
      map.delete(next)
      next++
      fn(data)
    }
  }
}
