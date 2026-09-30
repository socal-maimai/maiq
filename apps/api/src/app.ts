import { BadEndpoint, ErrorInternal } from '@maiq/types'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDeps } from '@maiq/api/lib/deps'
import { send } from '@maiq/api/lib/router'
import { ROUTES } from '@maiq/api/routes/index'
import { mountStream } from '@maiq/api/routes/stream'

export function createApp(deps: AppDeps): Hono {
  const app = new Hono()

  app.use(async (c, next) => {
    const started = performance.now()
    await next()
    deps.logger.debug(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - started),
      },
      'request'
    )
  })

  for (const route of ROUTES) route.mount(app, deps)
  mountStream(app, deps)

  app.get('/api/healthz', c => c.json({ ok: true }))
  app.get('/api/readyz', async c => {
    try {
      await deps.db.execute(sql`select 1`)
      return c.json({ ok: true })
    } catch (error) {
      deps.logger.error({ err: error }, 'Readiness check could not reach the database')
      return c.json({ ok: false }, 503)
    }
  })

  const discordHandler = deps.discordHandler
  if (discordHandler) app.post('/discord/interactions', c => discordHandler(c.req.raw))

  app.notFound(c => send(c, BadEndpoint))
  app.onError((error, c) => {
    deps.logger.error(
      { err: error, method: c.req.method, path: c.req.path },
      'Unhandled error while serving a request'
    )
    return send(c, ErrorInternal)
  })

  return app
}
