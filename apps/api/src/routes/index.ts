import type { MountableRoute } from '@maiq/api/lib/router'
import {
  adminModerationRoute,
  adminMuteRoute,
  adminReportsRoute,
  adminSessionRoute,
  adminTestReportRoute,
} from '@maiq/api/routes/admin'
import { buttonReportRoute } from '@maiq/api/routes/button-reports'
import { buttonsRoute } from '@maiq/api/routes/buttons'
import { clientConfigRoute } from '@maiq/api/routes/client-config'
import { confirmRoute } from '@maiq/api/routes/confirms'
import { linesRoute } from '@maiq/api/routes/lines'
import { reportRoute } from '@maiq/api/routes/reports'

export const ROUTES: readonly MountableRoute[] = [
  clientConfigRoute,
  linesRoute,
  reportRoute,
  confirmRoute,
  buttonsRoute,
  buttonReportRoute,
  adminSessionRoute,
  adminReportsRoute,
  adminModerationRoute,
  adminMuteRoute,
  adminTestReportRoute,
]
