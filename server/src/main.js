const { ApolloServer, gql } = require('apollo-server')
const jsonwebtoken = require('jsonwebtoken')
const { serveRequest } = require('../..')
const { chromium } = require('playwright-core')

const log = (format, ...args) => {
  console.log(`[${new Date().toJSON()}] ${format}`, ...args)
}

const typeDefs = gql`
  type Query {
    version: String!
  }
  type Mutation {
    runPlaywright(publishTopic: String!, subscriptionName: String!): Result!
  }
  type Result {
    ok: Boolean!
    message: String!
  }
`

const resolvers = {
  Query: {
    version: () => require('../package').version,
  },
  Mutation: {
    async runPlaywright(parent, args, context) {
      if (!context.authenticated) {
        return {
          ok: false,
          message: 'Unauthenticated (' + context.unauthenticatedMessage + ')',
        }
      }
      const { sessionEndPromise } = serveRequest({
        publishTopic: args.publishTopic,
        subscriptionName: args.subscriptionName,
        log: log,
        async launchTCPService() {
          log('Launch Chrome server')
          const browserServer = await chromium.launchServer({
            args: ['--disable-dev-shm-usage', '--no-sandbox'],
            executablePath: 'google-chrome-unstable',
          })
          const wsEndpoint = browserServer.wsEndpoint()
          log('Got endpoint', wsEndpoint)
          const [, port, endpoint] = wsEndpoint.match(/:(\d+)(\/.*$)/)
          return {
            port: +port,
            endpoint: endpoint,
            close: () => browserServer.close(),
          }
        },
      })
      await sessionEndPromise
      return { ok: true, message: 'Session finished' }
    },
  },
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => {
    const authorization = req.headers.authorization || ''
    try {
      jsonwebtoken.verify(
        authorization.split(' ').pop(),
        process.env.JWT_SECRET,
      )
      return { authenticated: true }
    } catch (error) {
      return { authenticated: false, unauthenticatedMessage: `${error}` }
    }
  },
})

server.listen({ port: +process.env.PORT || 4000 }).then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`)
})
