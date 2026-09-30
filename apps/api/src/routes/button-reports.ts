import { DESCRIPTION_MAX, type DescriptionProblem } from '@maiq/core/buttons'
import { PostButtonReport, toButtonStateJson } from '@maiq/types'
import { declareRoute } from '@maiq/api/lib/router'

const DESCRIPTION_REASONS: Record<DescriptionProblem, string> = {
  required: 'body.description: describe the problem',
  tooLong: `body.description: at most ${DESCRIPTION_MAX} characters`,
}

export const buttonReportRoute = declareRoute(PostButtonReport, async ({ body, res, deps }) => {
  const result = await deps.buttons.submit({
    lineId: body.lineId,
    cab: body.cab,
    side: body.side,
    button: body.button,
    kind: body.kind,
    description: body.description ?? '',
    reporter: `device:${body.deviceId}`,
  })
  if (result.ok) return res.goodButtonReport({ button: toButtonStateJson(result.state) })
  switch (result.error) {
    case 'unknownButton':
      return res.badUnknownButton()
    case 'invalidDescription':
      return res.badValidation({ reason: DESCRIPTION_REASONS[result.problem] })
    case 'tooManyReports':
      return res.badTooManyButtonReports({ retryAfterMs: result.retryAfterMs })
    case 'buttonCooldown':
      return res.badButtonCooldown({ retryAfterMs: result.retryAfterMs })
  }
})
