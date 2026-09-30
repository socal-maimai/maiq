import { GetClientConfig } from '@maiq/types'
import { declareRoute } from '@maiq/api/lib/router'

export const clientConfigRoute = declareRoute(GetClientConfig, ({ res, deps }) =>
  Promise.resolve(res.goodClientConfig({ turnstileSiteKey: deps.turnstileSiteKey }))
)
