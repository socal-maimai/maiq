import { arcadeOfLine, type Line } from '@maiq/core/arcades'
import { isWithinGeofence, type Point } from '@maiq/core/geo'
import type { Writer } from '@maiq/core/queue'

type WebWrite = { deviceId: string; location?: Point | undefined }

export const webWriter = (body: WebWrite, line: Line): Writer => ({
  lineId: line.id,
  source: 'web',
  reporter: `device:${body.deviceId}`,
  inGeofence: body.location ? isWithinGeofence(arcadeOfLine(line).location, body.location) : false,
})
