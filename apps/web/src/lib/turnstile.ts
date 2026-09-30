type RenderOptions = {
  sitekey: string
  execution: 'execute'
  appearance: 'interaction-only'
  callback: (token: string) => void
  'error-callback': (code: string) => void
  'expired-callback': () => void
  'timeout-callback': () => void
  'before-interactive-callback': () => void
  'after-interactive-callback': () => void
}

type TurnstileApi = {
  render(container: HTMLElement, options: RenderOptions): string
  execute(widgetId: string): void
  reset(widgetId: string): void
  remove(widgetId: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TOKEN_TIMEOUT_MS = 30_000

type Waiter = {
  resolve: (token: string) => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
}

type Widget = { id: string; api: TurnstileApi; element: HTMLElement }

let scriptLoad: Promise<TurnstileApi> | null = null
let widget: Widget | null = null
let bodyHost: HTMLElement | null = null
const hosts: HTMLElement[] = []
let waiter: Waiter | null = null

function loadScript(): Promise<TurnstileApi> {
  scriptLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.addEventListener('load', () => {
      if (window.turnstile) {
        resolve(window.turnstile)
        return
      }
      scriptLoad = null
      reject(new Error('The Turnstile script loaded but did not define window.turnstile'))
    })
    script.addEventListener('error', () => {
      scriptLoad = null
      script.remove()
      reject(new Error('Could not load Turnstile from challenges.cloudflare.com'))
    })
    document.head.append(script)
  })
  return scriptLoad
}

function settle(outcome: { token: string } | { error: Error }): void {
  const current = waiter
  waiter = null
  if (!current) return
  clearTimeout(current.timeoutId)
  if ('token' in outcome) current.resolve(outcome.token)
  else current.reject(outcome.error)
  setTimeout(retarget, 0)
}

function replaceWaiter(next: Waiter): void {
  if (waiter) {
    clearTimeout(waiter.timeoutId)
    waiter.reject(new Error('A newer Turnstile check replaced this one'))
  }
  waiter = next
}

function activeHost(): HTMLElement {
  const top = hosts.at(-1)
  if (top) return top
  if (!bodyHost) {
    bodyHost = document.createElement('div')
    bodyHost.dataset['turnstile'] = ''
  }
  if (!bodyHost.isConnected) document.body.append(bodyHost)
  return bodyHost
}

function retarget(): void {
  if (!widget || waiter || widget.element.parentElement === activeHost()) return
  widget.api.remove(widget.id)
  widget.element.remove()
  widget = null
}

export function turnstileHost(node: HTMLElement): () => void {
  hosts.push(node)
  retarget()
  return () => {
    hosts.splice(hosts.indexOf(node), 1)
    if (widget && node.contains(widget.element)) {
      settle({ error: new Error('The captcha check was cancelled. Try again.') })
    }
    retarget()
  }
}

function renderWidget(api: TurnstileApi, siteKey: string): Widget {
  const element = document.createElement('div')
  element.dataset['turnstileWidget'] = ''
  activeHost().append(element)
  const id = api.render(element, {
    sitekey: siteKey,
    execution: 'execute',
    appearance: 'interaction-only',
    callback: token => settle({ token }),
    'error-callback': code => settle({ error: new Error(`Turnstile failed with code ${code}`) }),
    'expired-callback': () =>
      settle({ error: new Error('The Turnstile check expired. Try again.') }),
    'timeout-callback': () =>
      settle({ error: new Error('The Turnstile check timed out. Try again.') }),
    'before-interactive-callback': () => {
      element.dataset['interactive'] = ''
    },
    'after-interactive-callback': () => {
      delete element.dataset['interactive']
    },
  })
  return { id, api, element }
}

export async function getTurnstileToken(siteKey: string): Promise<string> {
  const api = await loadScript()
  retarget()
  const firstRun = widget === null
  widget ??= renderWidget(api, siteKey)
  const { id } = widget
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      settle({ error: new Error('The captcha check took too long. Try again.') })
    }, TOKEN_TIMEOUT_MS)
    replaceWaiter({ resolve, reject, timeoutId })
    if (!firstRun) api.reset(id)
    api.execute(id)
  })
}
