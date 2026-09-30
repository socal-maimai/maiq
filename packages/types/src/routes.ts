import {
  BUTTONS_PER_STATION,
  DESCRIPTION_MAX,
  MAX_CABS_PER_LINE,
  REPORT_KINDS,
  STATION,
} from '@maiq/core/buttons'
import { MAX_PLAYERS_PER_LINE, MAX_QUEUE } from '@maiq/core/caps'
import { defineRoute } from '@maiq/types/contract'
import {
  BadButtonCooldown,
  BadCaptcha,
  BadNothingToConfirm,
  BadPlayersOverCap,
  BadRateLimit,
  BadTooManyButtonReports,
  BadUnknownArcade,
  BadUnknownButton,
  BadUnknownLine,
  BadValidation,
  GoodButtonReport,
  GoodButtons,
  GoodClientConfig,
  GoodConfirm,
  GoodLines,
  GoodReport,
} from '@maiq/types/responses'
import { z } from 'zod/mini'

const LocationSchema = z.object({
  lat: z.number().check(z.gte(-90), z.lte(90)),
  lng: z.number().check(z.gte(-180), z.lte(180)),
})

const IdSchema = z.string().check(z.minLength(1), z.maxLength(64))

const writerFields = {
  deviceId: z.uuid(),
  turnstileToken: z.string().check(z.minLength(1), z.maxLength(2048)),
}

const lineWriterFields = {
  lineId: IdSchema,
  location: z.optional(LocationSchema),
  ...writerFields,
}

const ReportBodySchema = z.object({
  ...lineWriterFields,
  players: z.int().check(z.gte(0), z.lte(MAX_PLAYERS_PER_LINE)),
  queue: z.int().check(z.gte(0), z.lte(MAX_QUEUE)),
})

const ConfirmBodySchema = z.object(lineWriterFields)

export const GetLines = defineRoute({
  method: 'GET',
  path: '/v1/lines',
  goodResponses: [GoodLines],
})

export const GetClientConfig = defineRoute({
  method: 'GET',
  path: '/v1/client-config',
  goodResponses: [GoodClientConfig],
})

export const PostReport = defineRoute({
  method: 'POST',
  path: '/v1/reports',
  body: ReportBodySchema,
  captcha: true,
  goodResponses: [GoodReport],
  badResponses: [BadValidation, BadUnknownLine, BadPlayersOverCap, BadRateLimit, BadCaptcha],
})

export const PostConfirm = defineRoute({
  method: 'POST',
  path: '/v1/confirms',
  body: ConfirmBodySchema,
  captcha: true,
  goodResponses: [GoodConfirm],
  badResponses: [BadValidation, BadUnknownLine, BadRateLimit, BadCaptcha, BadNothingToConfirm],
})

const ButtonsQuerySchema = z.object({
  arcadeId: z.optional(IdSchema),
})

const ButtonReportBodySchema = z.object({
  lineId: IdSchema,
  cab: z.int().check(z.gte(1), z.lte(MAX_CABS_PER_LINE)),
  side: z.union([z.literal(1), z.literal(2)]),
  button: z.int().check(z.gte(STATION), z.lte(BUTTONS_PER_STATION)),
  kind: z.enum(REPORT_KINDS),
  description: z.optional(z.string().check(z.trim(), z.maxLength(DESCRIPTION_MAX))),
  ...writerFields,
})

export const GetButtons = defineRoute({
  method: 'GET',
  path: '/v1/buttons',
  query: ButtonsQuerySchema,
  goodResponses: [GoodButtons],
  badResponses: [BadValidation, BadUnknownArcade],
})

export const PostButtonReport = defineRoute({
  method: 'POST',
  path: '/v1/button-reports',
  body: ButtonReportBodySchema,
  captcha: true,
  goodResponses: [GoodButtonReport],
  badResponses: [
    BadValidation,
    BadUnknownButton,
    BadTooManyButtonReports,
    BadButtonCooldown,
    BadCaptcha,
  ],
})

export const STREAM_PATH = '/v1/stream'
export const LINE_UPDATED_EVENT = 'line-updated'
export const BUTTON_UPDATED_EVENT = 'button-updated'
