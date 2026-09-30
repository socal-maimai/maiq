import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import * as image from '@maiq/bot/buttons/image'
import { buttonsSvg, escapeXml, IMAGE_WIDTH, renderButtonsPng } from '@maiq/bot/buttons/image'
import { buttonsReply, MAX_ALT_TEXT_LENGTH } from '@maiq/bot/commands/buttons'
import type { Arcade } from '@maiq/core/arcades'
import type { ButtonState } from '@maiq/core/button-service'
import type { ButtonStatus, ConfirmedStatus, Side } from '@maiq/core/buttons'
import { createTestBotApp } from 'maiq-tests-api/support/app'
import { commandInteraction, replyTo, type DiscordCall } from 'maiq-tests-api/support/discord'
import { arcade } from 'maiq-tests-api/support/lookup'

const WIDTHS = [40, 80, 55, 65]
const MUTED = '#97a1bb'
const STATUS_COLOR = {
  good: '#34b36b',
  unreliable: '#f3b61f',
  broken: '#e5484d',
  pending: '#a3acbd',
}

function state(
  where: { lineId: string; cab: number; side: Side; button: number },
  status: ButtonStatus,
  confirmed: ConfirmedStatus = status === 'pending' ? 'good' : status
): ButtonState {
  return { ...where, status, confirmed, pending: null, pendingVotes: 0, recent: [] }
}

const rowLabels = (svg: string): string[] =>
  [...svg.matchAll(/data-part="row-label">([^<]*)</g)].map(match => match[1] ?? '')

const rows = (svg: string): string[] => svg.split('data-part="row"').slice(1)

const ringOf = (row: string, side: Side): string =>
  row.split(`data-side="${side}"`)[1]?.split('data-side=')[0] ?? ''

const numberColor = (ring: string, button: number): string | undefined =>
  new RegExp(`fill="(#[0-9a-f]+)" data-button="${button}"`).exec(ring)?.[1]

const label = (color: string, text: string) =>
  `y="97" text-anchor="middle" font-size="26" fill="${color}">${text}<`

const badge = (color: string) =>
  `<g transform="translate(89 104) scale(1.1)"><circle cx="10" cy="10" r="9.2" fill="${color}"/>`

describe('buttonsSvg', () => {
  test('draws one unlabelled row for a one-cab arcade', () => {
    const svg = buttonsSvg(arcade('2nd-loop'), [], WIDTHS)
    expect(rows(svg)).toHaveLength(1)
    expect(rowLabels(svg)).toEqual([])
    expect(svg).toContain('>2nd Loop</text>')
    expect(svg).toMatch(/<g transform="translate\(0 116\)" data-part="row">/)
  })

  test('draws a labelled row per cabinet for Lakewood', () => {
    const svg = buttonsSvg(arcade('lakewood'), [], WIDTHS)
    expect(rows(svg)).toHaveLength(3)
    expect(rowLabels(svg)).toEqual(['Main cab 1', 'Main cab 2', 'Cuck cab'])
    expect(svg).toMatch(/<g transform="translate\(0 151\)" data-part="row">/)
    expect(svg).toMatch(/<g transform="translate\(0 484\)" data-part="row">/)
    expect(svg).toMatch(/<g transform="translate\(0 817\)" data-part="row">/)
    expect(svg.match(/data-part="block"/g)).toHaveLength(3)
  })

  test('colors good button numbers muted and problem numbers by status', () => {
    const where = { lineId: '2nd-loop', cab: 1, side: 2 as const }
    const svg = buttonsSvg(
      arcade('2nd-loop'),
      [
        state({ ...where, button: 3 }, 'broken'),
        state({ ...where, button: 4 }, 'unreliable'),
        state({ ...where, button: 5 }, 'pending'),
      ],
      WIDTHS
    )
    const [row = ''] = rows(svg)
    const ring = ringOf(row, 2)
    expect(numberColor(ring, 1)).toBe(MUTED)
    expect(numberColor(ring, 3)).toBe(STATUS_COLOR.broken)
    expect(numberColor(ring, 4)).toBe(STATUS_COLOR.unreliable)
    expect(numberColor(ring, 5)).toBe(STATUS_COLOR.pending)
    expect(numberColor(ringOf(row, 1), 3)).toBe(MUTED)
  })

  test('dims a down side and says Down on its screen', () => {
    const svg = buttonsSvg(
      arcade('2nd-loop'),
      [state({ lineId: '2nd-loop', cab: 1, side: 1, button: 0 }, 'broken')],
      WIDTHS
    )
    const [row = ''] = rows(svg)
    const down = ringOf(row, 1)
    const up = ringOf(row, 2)
    expect(down).toContain('>Down</text>')
    expect(down).toContain('<g opacity="0.35"><polygon')
    expect(up).toContain('>2P</text>')
    expect(up).not.toContain('opacity=')
  })

  test('colors a side label by its confirmed status over a status face', () => {
    const where = { lineId: '2nd-loop', cab: 1, button: 0 }
    const svg = buttonsSvg(
      arcade('2nd-loop'),
      [state({ ...where, side: 1 }, 'unreliable'), state({ ...where, side: 2 }, 'pending')],
      WIDTHS
    )
    const [row = ''] = rows(svg)
    expect(ringOf(row, 1)).toContain(label(STATUS_COLOR.unreliable, '1P'))
    expect(ringOf(row, 1)).toContain(badge(STATUS_COLOR.unreliable))
    expect(ringOf(row, 2)).toContain(label(STATUS_COLOR.good, '2P'))
    expect(ringOf(row, 2)).toContain(badge(STATUS_COLOR.pending))
  })

  test('escapes text for XML', () => {
    expect(escapeXml(`A & B <"c">'`)).toBe('A &amp; B &lt;&quot;c&quot;&gt;&apos;')
    const svg = buttonsSvg({ ...arcade('2nd-loop'), name: 'Loop & Co <2>' }, [], WIDTHS)
    expect(svg).toContain('>Loop &amp; Co &lt;2&gt;</text>')
  })
})

describe('renderButtonsPng', () => {
  test('renders a PNG 1280 px wide', async () => {
    const png = await renderButtonsPng(arcade('lakewood'), [])
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const ihdr = new DataView(png.buffer, png.byteOffset + 16, 8)
    expect(new TextDecoder().decode(png.subarray(12, 16))).toBe('IHDR')
    expect(ihdr.getUint32(0)).toBe(IMAGE_WIDTH)
    expect(ihdr.getUint32(4)).toBeGreaterThan(IMAGE_WIDTH)
  })
})

type Child = {
  type: number
  content?: string
  items?: { media: { url: string }; description?: string }[]
}
type ReplyBody = {
  flags?: number
  components?: Child[]
  attachments?: { id: number; filename: string }[]
}

async function buttonsReplyCall(): Promise<DiscordCall & { logged: unknown[] }> {
  const t = await createTestBotApp()
  const logged: unknown[] = []
  spyOn(t.deps.logger, 'error').mockImplementation((details: unknown) => {
    logged.push(details)
  })
  const call = await replyTo(t, commandInteraction('buttons', [['arcade', 'burbank']]), 5000)
  return { ...call, logged }
}

const COMPONENTS_V2 = 1 << 15
const TEXT_DISPLAY = 10
const MEDIA_GALLERY = 12

describe('/buttons image reply', () => {
  afterEach(() => {
    mock.restore()
  })

  test('attaches the PNG and shows it as the only component when all is well', async () => {
    const call = await buttonsReplyCall()
    const body = call.body as ReplyBody
    expect((body.flags ?? 0) & COMPONENTS_V2).toBe(COMPONENTS_V2)
    expect(body.components?.map(c => c.type)).toEqual([MEDIA_GALLERY])
    const gallery = body.components?.[0]
    expect(gallery?.items?.[0]?.media.url).toBe('attachment://buttons.png')
    expect(gallery?.items?.[0]?.description).toBe('Round1 Burbank: All buttons and sides working')
    expect(body.attachments).toEqual([{ id: 0, filename: 'buttons.png' }])
    expect(call.files.map(file => [file.field, file.name])).toEqual([['files[0]', 'buttons.png']])
    const bytes = new Uint8Array((await call.files[0]?.data.arrayBuffer()) ?? new ArrayBuffer(0))
    expect([...bytes.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47])
  })

  test('leaves the image out when rendering fails', async () => {
    spyOn(image, 'renderButtonsPng').mockRejectedValue(new Error('no resvg'))
    const call = await buttonsReplyCall()
    const body = call.body as ReplyBody
    expect(call.files).toEqual([])
    expect((body.flags ?? 0) & COMPONENTS_V2).toBe(COMPONENTS_V2)
    expect(body.components?.map(c => c.type)).toEqual([TEXT_DISPLAY])
    expect(body.components?.[0]?.content).toStartWith('## Round1 Burbank')
    expect(call.logged).toEqual([expect.objectContaining({ arcadeId: 'burbank' })])
  })
})

const silent = { error: () => undefined, warn: () => undefined, info: () => undefined }

async function serializedReply(target: Arcade, states: ButtonState[]): Promise<Child[]> {
  const reply = await buttonsReply(target, states, silent)
  if (typeof reply === 'string') throw new Error('expected an object reply')
  return (reply.components ?? []).map(component => component.serialize() as Child)
}

describe('buttonsReply', () => {
  test('is just the gallery when every button works', async () => {
    const components = await serializedReply(arcade('2nd-loop'), [])
    expect(components.map(c => c.type)).toEqual([MEDIA_GALLERY])
  })

  test('is the gallery then one text with the cabinets joined by a blank line', async () => {
    const components = await serializedReply(arcade('lakewood'), [
      state({ lineId: 'lakewood:main', cab: 2, side: 1, button: 1 }, 'broken'),
      state({ lineId: 'lakewood:cuck', cab: 1, side: 2, button: 4 }, 'unreliable'),
    ])
    expect(components.map(c => c.type)).toEqual([MEDIA_GALLERY, TEXT_DISPLAY])
    const content = components[1]?.content ?? ''
    expect(content.split('\n\n')).toHaveLength(2)
    expect(content).toStartWith('**Main cab 2**')
    expect(content).toContain('\n\n**Cuck cab**')
  })

  test('caps the gallery alt text at 1024 characters', async () => {
    const long = { ...arcade('2nd-loop'), name: 'Loop '.repeat(300) }
    const components = await serializedReply(long, [])
    const gallery = components.find(c => c.type === MEDIA_GALLERY)
    const description = gallery?.items?.[0]?.description ?? ''
    expect(description).toHaveLength(MAX_ALT_TEXT_LENGTH)
    expect(description.endsWith('…')).toBe(true)
  })
})
