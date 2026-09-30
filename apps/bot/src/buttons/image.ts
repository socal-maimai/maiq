import { join } from 'node:path'
import type { Arcade } from '@maiq/core/arcades'
import type { ButtonState } from '@maiq/core/button-service'
import {
  BUTTON_STATUSES,
  buttonKey,
  type ButtonRef,
  type ButtonStatus,
  type Cabinet,
  cabinetsOf,
  SIDES,
  type Side,
  STATION,
  STATUS_LABEL,
  type StatusPair,
  UNREPORTED,
} from '@maiq/core/buttons'
import { FACE_EYES, FACE_MOUTHS } from '@maiq/core/face'
import { buttonCenter, RING_SLOTS } from '@maiq/core/station'

const FONT_FAMILY = 'Rounded Mplus 1c'
const FONT_PATH = join(import.meta.dir, '..', '..', 'assets', 'MPLUSRounded1c-ExtraBold.ttf')

export const IMAGE_WIDTH = 1280

const COLOR = {
  card: '#1c2440',
  block: '#121829',
  ink: '#eef2fb',
  muted: '#97a1bb',
  bezel: '#2a3350',
  rim: '#1c2440',
  screen: '#26345a',
  faceInk: '#ffffff',
  faceInkUnreliable: '#5a4200',
} as const

const STATUS_COLOR: Record<ButtonStatus, string> = {
  good: '#34b36b',
  unreliable: '#f3b61f',
  broken: '#e5484d',
  pending: '#a3acbd',
}

const LEGEND = BUTTON_STATUSES.map(status => ({ status, label: STATUS_LABEL[status] }))

export type LegendWidths = readonly number[]

const WIDTH = 664
const EDGE = 32
const INNER = 28
const CONTENT_X = EDGE + INNER
const BLOCK_GAP = 16
const BLOCK_RADIUS = 22
const TITLE = { size: 30, cap: 21, gap: 24 }
const LABEL = { size: 19, cap: 13, gap: 22 }
const RING_INK = { top: 11, bottom: 215, side: 19 }
const RING_X: Record<Side, number> = {
  1: EDGE + INNER + RING_INK.side,
  2: WIDTH - EDGE - INNER - (200 + RING_INK.side),
}
const NUMBER_RADIUS = 114
const LEGEND_ICON = 24
const LEGEND_GAP = 8
const LEGEND_FONT_SIZE = 17
const DOWN_OPACITY = 0.35

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

export const escapeXml = (text: string): string =>
  text.replace(/[&<>"']/g, c => XML_ESCAPES[c] ?? c)

const fixed = (value: number): string => value.toFixed(1)

function face(status: ButtonStatus): string {
  const ink = status === 'unreliable' ? COLOR.faceInkUnreliable : COLOR.faceInk
  const fill = status === 'pending' ? ink : 'none'
  const eyes = FACE_EYES.map(
    eye => `<circle cx="${eye.cx}" cy="${eye.cy}" r="${eye.r}" fill="${ink}"/>`
  ).join('')
  return (
    eyes +
    `<path d="${FACE_MOUTHS[status]}" fill="${fill}" stroke="${ink}" stroke-width="1.7" ` +
    `stroke-linecap="round" stroke-linejoin="round"/>`
  )
}

type StatusOf = (ref: ButtonRef) => StatusPair
type RingAt = { lineId: string; cab: number; side: Side }

function statusLookup(states: readonly ButtonState[]): StatusOf {
  const byKey = new Map(states.map(state => [buttonKey(state), state]))
  return ref => byKey.get(buttonKey(ref)) ?? UNREPORTED
}

function screen(side: Side, station: StatusPair): string {
  const label = station.confirmed === 'broken' ? 'Down' : `${side}P`
  const badge: ButtonStatus = station.status === 'pending' ? 'pending' : station.confirmed
  return (
    `<text x="100" y="97" text-anchor="middle" font-size="26" ` +
    `fill="${STATUS_COLOR[station.confirmed]}">${label}</text>` +
    `<g transform="translate(89 104) scale(1.1)">` +
    `<circle cx="10" cy="10" r="9.2" fill="${STATUS_COLOR[badge]}"/>${face(badge)}</g>`
  )
}

function slots(at: RingAt, statusOf: StatusOf): string {
  let out = ''
  for (const slot of RING_SLOTS) {
    const { status } = statusOf({ ...at, button: slot.button })
    const [numberX, numberY] = buttonCenter(slot.button, NUMBER_RADIUS)
    const numberColor = status === 'good' ? COLOR.muted : STATUS_COLOR[status]
    out +=
      `<polygon points="${slot.points}" fill="${STATUS_COLOR[status]}" stroke="${COLOR.rim}" ` +
      `stroke-width="2.5" stroke-linejoin="round"/>` +
      `<g transform="${slot.faceAt}">${face(status)}</g>` +
      `<text x="${fixed(numberX)}" y="${fixed(numberY + 5)}" text-anchor="middle" ` +
      `font-size="15" fill="${numberColor}" data-button="${slot.button}">${slot.button}</text>`
  }
  return out
}

function ring(at: RingAt, statusOf: StatusOf): string {
  const station = statusOf({ ...at, button: STATION })
  const down = station.confirmed === 'broken'
  const buttons = slots(at, statusOf)
  return (
    `<g transform="translate(${RING_X[at.side]} 0)" data-side="${at.side}">` +
    `<circle cx="100" cy="100" r="99" fill="${COLOR.bezel}"/>` +
    `<circle cx="100" cy="100" r="68" fill="${COLOR.rim}"/>` +
    `<circle cx="100" cy="100" r="61" fill="${COLOR.screen}"/>` +
    screen(at.side, station) +
    (down ? `<g opacity="${DOWN_OPACITY}">${buttons}</g>` : buttons) +
    `</g>`
  )
}

function legend(y: number, widths: LegendWidths): string {
  const itemWidths = LEGEND.map((_, index) => LEGEND_ICON + LEGEND_GAP + (widths[index] ?? 0))
  const used = itemWidths.reduce((sum, width) => sum + width, 0)
  const space = (WIDTH - 2 * CONTENT_X - used) / (LEGEND.length - 1)
  const radius = LEGEND_ICON / 2
  let x = CONTENT_X
  let out = ''
  for (const [index, { status, label }] of LEGEND.entries()) {
    out +=
      `<circle cx="${fixed(x + radius)}" cy="${y - 6}" r="${radius}" ` +
      `fill="${STATUS_COLOR[status]}"/>` +
      `<g transform="translate(${fixed(x + radius - 11)} ${fixed(y - 6 - 11.3)}) scale(1.1)">` +
      `${face(status)}</g>` +
      `<text x="${fixed(x + LEGEND_ICON + LEGEND_GAP)}" y="${y}" ` +
      `font-size="${LEGEND_FONT_SIZE}" fill="${COLOR.muted}">${label}</text>`
    x += (itemWidths[index] ?? 0) + space
  }
  return out
}

function cabinetBlock(cabinet: Cabinet, top: number, labelled: boolean, statusOf: StatusOf) {
  const width = WIDTH - 2 * EDGE
  let body = ''
  let ringTop = top + INNER + RING_INK.top
  if (labelled) {
    const baseline = top + INNER + LABEL.cap
    body +=
      `<text x="${CONTENT_X}" y="${baseline}" font-size="${LABEL.size}" fill="${COLOR.muted}" ` +
      `data-part="row-label">${escapeXml(cabinet.label)}</text>`
    ringTop = baseline + LABEL.gap + RING_INK.top
  }
  const bottom = ringTop + RING_INK.bottom + INNER
  body += `<g transform="translate(0 ${ringTop})" data-part="row">`
  for (const side of SIDES) {
    body += ring({ lineId: cabinet.line.id, cab: cabinet.cab, side }, statusOf)
  }
  body += '</g>'
  const block =
    `<rect x="${EDGE}" y="${top}" width="${width}" height="${bottom - top}" ` +
    `rx="${BLOCK_RADIUS}" fill="${COLOR.block}" data-part="block"/>`
  return { svg: block + body, bottom }
}

export function buttonsSvg(
  arcade: Arcade,
  states: readonly ButtonState[],
  legendWidths: LegendWidths
): string {
  const statusOf = statusLookup(states)
  const cabinets = cabinetsOf(arcade)
  const labelled = cabinets.length > 1
  const titleBaseline = EDGE + TITLE.cap
  let body =
    `<text x="${EDGE}" y="${titleBaseline}" font-size="${TITLE.size}" fill="${COLOR.ink}">` +
    `${escapeXml(arcade.name)}</text>`
  let top = titleBaseline + TITLE.gap
  let bottom = top
  for (const cabinet of cabinets) {
    const block = cabinetBlock(cabinet, top, labelled, statusOf)
    body += block.svg
    bottom = block.bottom
    top = bottom + BLOCK_GAP
  }
  const legendBaseline = bottom + 24 + LEGEND_ICON / 2 + 6
  body += legend(legendBaseline, legendWidths)
  const height = legendBaseline + 6 + EDGE
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" ` +
    `width="${WIDTH}" height="${height}" font-family="${FONT_FAMILY}" font-weight="800">` +
    `<rect width="${WIDTH}" height="${height}" rx="32" fill="${COLOR.card}"/>${body}</svg>`
  )
}

type Resvg = typeof import('@resvg/resvg-js')

const FONT_OPTIONS = {
  fontFiles: [FONT_PATH],
  loadSystemFonts: false,
  defaultFontFamily: FONT_FAMILY,
}

let resvg: Promise<Resvg> | null = null
const loadResvg = (): Promise<Resvg> => (resvg ??= import('@resvg/resvg-js'))

let legendWidths: LegendWidths | null = null

async function measureLegendLabels(): Promise<LegendWidths> {
  if (legendWidths) return legendWidths
  const { Resvg } = await loadResvg()
  legendWidths = LEGEND.map(({ label }) => {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="40">` +
      `<text x="0" y="30" font-size="${LEGEND_FONT_SIZE}" font-family="${FONT_FAMILY}" ` +
      `font-weight="800">${label}</text></svg>`
    const box = new Resvg(svg, { font: FONT_OPTIONS }).getBBox()
    if (!box) throw new Error(`resvg could not measure the legend label "${label}"`)
    return box.width
  })
  return legendWidths
}

export async function renderButtonsPng(
  arcade: Arcade,
  states: readonly ButtonState[]
): Promise<Uint8Array> {
  const svg = buttonsSvg(arcade, states, await measureLegendLabels())
  const { renderAsync } = await loadResvg()
  const image = await renderAsync(svg, {
    font: FONT_OPTIONS,
    fitTo: { mode: 'width', value: IMAGE_WIDTH },
  })
  return image.asPng()
}
