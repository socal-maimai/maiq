import { response } from '@maiq/types/contract'
import {
  AdminButtonReportJsonSchema,
  AdminQueueReportJsonSchema,
  ButtonStateJsonSchema,
  LineStateJsonSchema,
  MuteJsonSchema,
} from '@maiq/types/models'
import { z } from 'zod/mini'

const LinePayload = z.object({ line: LineStateJsonSchema })
const RetryAfter = z.object({ retryAfterMs: z.int() })

export const GoodLines = response('goodLines', {
  status: 200,
  message: 'Current queue state.',
  data: z.object({ lines: z.array(LineStateJsonSchema) }),
})

export const GoodReport = response('goodReport', {
  status: 200,
  message: 'Thanks for the update.',
  data: LinePayload,
})

export const GoodConfirm = response('goodConfirm', {
  status: 200,
  message: 'Thanks for confirming.',
  data: LinePayload,
})

export const GoodClientConfig = response('goodClientConfig', {
  status: 200,
  message: 'Client configuration.',
  data: z.object({ turnstileSiteKey: z.string() }),
})

export const BadValidation = response('badValidation', {
  status: 400,
  message: 'The request is not valid.',
  data: z.object({ reason: z.string() }),
})

export const BadUnknownLine = response('badUnknownLine', {
  status: 404,
  message: 'That arcade line does not exist.',
})

export const BadPlayersOverCap = response('badPlayersOverCap', {
  status: 400,
  message: 'More players than this line has seats.',
  data: z.object({ maxPlayers: z.int() }),
})

export const BadRateLimit = response('badRateLimit', {
  status: 429,
  message: 'You just updated this line. Try again shortly.',
  data: RetryAfter,
})

export const BadCaptcha = response('badCaptcha', {
  status: 403,
  message: 'The captcha check failed. Reload the page and try again.',
})

export const BadNothingToConfirm = response('badNothingToConfirm', {
  status: 409,
  message: 'There is no recent report to confirm.',
})

export const BadEndpoint = response('badEndpoint', {
  status: 404,
  message: 'Endpoint not found.',
})

export const ErrorInternal = response('errorInternal', {
  status: 500,
  message: 'Something went wrong on our side.',
})

export const GoodButtons = response('goodButtons', {
  status: 200,
  message: 'Current button status.',
  data: z.object({ buttons: z.array(ButtonStateJsonSchema) }),
})

export const GoodButtonReport = response('goodButtonReport', {
  status: 200,
  message: 'Thanks for the report.',
  data: z.object({ button: ButtonStateJsonSchema }),
})

export const BadUnknownArcade = response('badUnknownArcade', {
  status: 404,
  message: 'That arcade does not exist.',
})

export const BadUnknownButton = response('badUnknownButton', {
  status: 404,
  message: 'That button does not exist.',
})

export const BadTooManyButtonReports = response('badTooManyButtonReports', {
  status: 429,
  message: "You've sent a lot of button reports. Try again in a few minutes.",
  data: RetryAfter,
})

export const BadButtonCooldown = response('badButtonCooldown', {
  status: 429,
  message: 'You reported this button a few minutes ago.',
  data: RetryAfter,
})

export const BadSignedOut = response('badSignedOut', {
  status: 401,
  message: 'Sign in with Discord to use the admin dashboard.',
})

export const BadOrigin = response('badOrigin', {
  status: 403,
  message: 'This request came from another site.',
})

export const BadUnknownReport = response('badUnknownReport', {
  status: 404,
  message: 'That report does not exist.',
})

export const GoodAdminSession = response('goodAdminSession', {
  status: 200,
  message: 'Signed in.',
  data: z.object({ id: z.string(), name: z.string() }),
})

export const GoodAdminReports = response('goodAdminReports', {
  status: 200,
  message: 'Recent reports.',
  data: z.object({
    queue: z.array(AdminQueueReportJsonSchema),
    buttons: z.array(AdminButtonReportJsonSchema),
    mutes: z.array(MuteJsonSchema),
  }),
})

export const GoodModeration = response('goodModeration', {
  status: 200,
  message: 'Report updated.',
})

export const GoodMute = response('goodMute', {
  status: 200,
  message: 'Mute updated.',
})

export const GoodTestReport = response('goodTestReport', {
  status: 200,
  message: 'Test report sent.',
  data: LinePayload,
})
