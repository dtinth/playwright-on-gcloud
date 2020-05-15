declare module 'mux-demux/msgpack' {
  import { Duplex } from 'stream'

  const MuxDemux: (
    handler?: (connection: Duplex) => void,
  ) => Duplex & {
    close: () => void
    createStream: (meta: any) => Duplex
  }
  export = MuxDemux
}

declare module 'msgpack-js' {
  namespace msgpack {
    const encode: (thing: any) => Buffer
    const decode: (thing: Buffer) => any
  }
  export = msgpack
}
