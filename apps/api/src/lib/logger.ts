import pino, { type LevelWithSilent, type Logger } from 'pino'

export type { Logger }

export const createLogger = (level: LevelWithSilent): Logger => pino({ level })
