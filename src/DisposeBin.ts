import Debug from 'debug'
const debug = Debug('playwright-on-gcloud:DisposeBin')

export class DisposeBin {
  things: { name: string; fn: () => Promise<void> }[] | null = []
  constructor() {
    this.things = []
  }
  async register<T>(
    name: string,
    create: () => Promise<T>,
    dispose: (t: T) => Promise<void>,
  ) {
    this.guard()
    debug('Registering %s', name)
    const result = await create()
    debug('Registered %s', name)
    this.add(name, () => dispose(result))
    return result
  }
  guard() {
    if (!this.things) throw new Error('Already disposed!')
  }
  add(name: string, dispose: () => Promise<void>) {
    const fn = async () => {
      debug('Disposing %s', name)
      return dispose()
    }
    if (this.things) {
      this.things.push({ name, fn })
    } else {
      fn().catch((e) => {
        console.error('Cannot dispose %s:', name, e)
      })
    }
  }
  async dispose() {
    this.guard()
    const things = this.things
    this.things = null
    await Promise.all(
      things!.map((thing) =>
        thing.fn().catch((e) => {
          console.error('Cannot dispose %s:', thing.name, e)
        }),
      ),
    )
  }
}
