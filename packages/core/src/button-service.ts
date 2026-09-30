import type { ButtonRef, ButtonVerdict, DescriptionProblem, ReportKind } from '@maiq/core/buttons'

export type RecentReport = { kind: ReportKind; description: string; at: Date }

export type ButtonState = ButtonRef & ButtonVerdict & { recent: RecentReport[] }

export type ButtonReportInput = ButtonRef & {
  kind: ReportKind
  description: string
  reporter: string
}

export type ButtonWriteError =
  | { error: 'unknownButton' }
  | { error: 'invalidDescription'; problem: DescriptionProblem }
  | { error: 'tooManyReports'; retryAfterMs: number }
  | { error: 'buttonCooldown'; retryAfterMs: number }

export type ButtonWriteResult =
  | { ok: true; state: ButtonState }
  | ({ ok: false } & ButtonWriteError)

export type ButtonService = {
  buttonStates(lineIds?: readonly string[]): Promise<ButtonState[]>
  submit(input: ButtonReportInput): Promise<ButtonWriteResult>
}
