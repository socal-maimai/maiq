import type { ComponentData } from '@buape/carbon'
import { findLine, type Line } from '@maiq/core/arcades'

export const encodeLineId = (lineId: string): string => lineId.replace(':', '~')

const decodeLineId = (value: unknown): string => String(value).replace('~', ':')

export const lineCustomId = (prefix: string, line: Line | null): string =>
  line ? `${prefix}:line=${encodeLineId(line.id)}` : prefix

export const lineFromData = (data: ComponentData): Line | undefined =>
  findLine(decodeLineId(data['line']))
