import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g
const TURNSTILE = 'https://challenges.cloudflare.com'

function inlineScriptHashes(buildDir: string): string[] {
  const hashes = new Set<string>()
  for (const file of readdirSync(buildDir, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.html')) continue
    const html = readFileSync(path.join(buildDir, file), 'utf8')
    for (const [, body = ''] of html.matchAll(INLINE_SCRIPT)) {
      hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`)
    }
  }
  return [...hashes].toSorted()
}

const [buildDir, outFile] = Bun.argv.slice(2)
if (!buildDir || !outFile)
  throw new Error('Usage: bun deploy/csp.ts <web build dir> <output .conf>')
const hashes = inlineScriptHashes(buildDir)
if (hashes.length === 0) {
  throw new Error(`No inline <script> in ${buildDir}. Check that the web build ran first.`)
}
const policy = [
  "default-src 'self'",
  `script-src 'self' ${hashes.join(' ')} ${TURNSTILE}`,
  `frame-src ${TURNSTILE}`,
  `connect-src 'self' ${TURNSTILE}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')
writeFileSync(outFile, `add_header Content-Security-Policy "${policy}" always;\n`)
