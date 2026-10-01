import { z } from 'zod/mini'

z.config(z.locales.en())

export type HttpMethod = 'GET' | 'POST'
// oxlint-disable-next-line typescript/no-explicit-any -- route definitions differ by design
export type Schema = z.ZodMiniType<any, any>
export type Infer<T> = T extends Schema ? z.output<T> : undefined
export type InferInput<T> = T extends Schema ? z.input<T> : undefined

export interface ResponseDefinition<
  TKind extends string = string,
  TDataSchema extends Schema | undefined = Schema | undefined,
> {
  readonly kind: TKind
  readonly status: number
  readonly message: string
  readonly dataSchema: TDataSchema
  readonly schema: Schema
}

type ResponseOptions<TDataSchema extends Schema | undefined> = {
  status: number
  message: string
  data?: TDataSchema
}

export function response<TKind extends string, TDataSchema extends Schema | undefined = undefined>(
  kind: TKind,
  options: ResponseOptions<TDataSchema>
): ResponseDefinition<TKind, TDataSchema> {
  const envelope = { kind: z.literal(kind), message: z.literal(options.message) }
  return {
    kind,
    status: options.status,
    message: options.message,
    dataSchema: options.data as TDataSchema,
    schema: options.data ? z.object({ ...envelope, data: options.data }) : z.object(envelope),
  }
}

export type ResponseBody<TDef extends ResponseDefinition> = TDef extends ResponseDefinition
  ? TDef['dataSchema'] extends Schema
    ? { kind: TDef['kind']; message: string; data: Infer<TDef['dataSchema']> }
    : { kind: TDef['kind']; message: string }
  : never

export type ResponseResult<TDef extends ResponseDefinition> = {
  status: number
  body: ResponseBody<TDef>
  definition: TDef
}

export type ResponseHelper<TDef extends ResponseDefinition> = TDef['dataSchema'] extends Schema
  ? (payload: z.input<NonNullable<TDef['dataSchema']>>) => ResponseResult<TDef>
  : () => ResponseResult<TDef>

export type ResponseHelpers<TResponses extends readonly ResponseDefinition[]> = {
  [R in TResponses[number] as R['kind']]: ResponseHelper<R>
}

export type ResponseCollection = readonly ResponseDefinition[]

export interface RouteConfig {
  method: HttpMethod
  path: string
  goodResponses: ResponseCollection
  badResponses?: ResponseCollection
  body?: Schema
  query?: Schema
  captcha?: boolean
  admin?: boolean
}

export interface RouteDefinition<T extends RouteConfig = RouteConfig> {
  readonly method: T['method']
  readonly path: T['path']
  readonly body: T['body']
  readonly query: T['query']
  readonly goodResponses: T['goodResponses']
  readonly badResponses: T['badResponses'] extends ResponseCollection
    ? T['badResponses']
    : readonly []
  readonly captcha: T['captcha'] extends true ? true : false
  readonly admin: T['admin'] extends true ? true : false
}

export function defineRoute<const T extends RouteConfig>(config: T): RouteDefinition<T> {
  return {
    method: config.method,
    path: config.path,
    body: config.body,
    query: config.query,
    goodResponses: config.goodResponses,
    badResponses: config.badResponses ?? [],
    captcha: config.captcha === true,
    admin: config.admin === true,
  } as unknown as RouteDefinition<T>
}

// oxlint-disable-next-line typescript/no-explicit-any -- route definitions differ by design
export type AnyRouteDefinition = RouteDefinition<any>

type AllResponses<T extends AnyRouteDefinition> = readonly [
  ...T['goodResponses'],
  ...T['badResponses'],
]

export type RouteBody<T extends AnyRouteDefinition> = Infer<T['body']>
export type RouteBodyInput<T extends AnyRouteDefinition> = InferInput<T['body']>
export type RouteQuery<T extends AnyRouteDefinition> = Infer<T['query']>
export type RouteResponse<T extends AnyRouteDefinition> = ResponseBody<AllResponses<T>[number]>
export type RouteHandlerResult<T extends AnyRouteDefinition> = ResponseResult<
  AllResponses<T>[number]
>
export type RouteResponders<T extends AnyRouteDefinition> = ResponseHelpers<AllResponses<T>>
