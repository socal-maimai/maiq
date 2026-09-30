<script lang="ts" module>
  import { SIDES, STATION, type ButtonRef } from '@maiq/core/buttons'

  export type CardTarget =
    | { kind: 'one'; ref: ButtonRef }
    | { kind: 'wholeCab'; lineId: string; cab: number }

  export const refsOf = (target: CardTarget): ButtonRef[] =>
    target.kind === 'one'
      ? [target.ref]
      : SIDES.map(side => ({ lineId: target.lineId, cab: target.cab, side, button: STATION }))
</script>

<script lang="ts">
  import { findLine } from '@maiq/core/arcades'
  import {
    AGREE_PEOPLE,
    buttonKey,
    cabinetLabel,
    checkDescription,
    DESCRIPTION_MAX,
    isStation,
    KIND_LABEL,
    needsDescription,
    REPORT_KINDS,
    STATUS_LABEL,
    stationKindLabel,
    stationStatusLabel,
    statusOfKind,
    type ReportKind,
  } from '@maiq/core/buttons'
  import { retryText } from '@maiq/core/retry'
  import { formatAge } from '@maiq/core/state'
  import { PostButtonReport, type ButtonStateJson } from '@maiq/types'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { tick } from 'svelte'
  import { apiRequest } from '$lib/api'
  import { hintForError } from '$lib/api-error'
  import { clock } from '$lib/clock.svelte'
  import FaceIcon from '$lib/components/face-icon.svelte'
  import MiniStation from '$lib/components/mini-station.svelte'
  import { nudge, nudgeable } from '$lib/nudge'
  import { storeButton } from '$lib/query'
  import { toast } from '$lib/toast'
  import { turnstileHost } from '$lib/turnstile'
  import Dialog from '$lib/ui/dialog.svelte'
  import { writerFields } from '$lib/writes'

  type Props = {
    states: ReadonlyMap<string, ButtonStateJson>
    onclosed: (target: CardTarget, sent: boolean) => void
  }

  let { states, onclosed }: Props = $props()

  type Draft = { kind: ReportKind | null; text: string }
  type SendResult = { kind: 'sent' } | { kind: 'abandoned' } | { kind: 'refused'; hint: string }

  const PIPS = Array.from({ length: AGREE_PEOPLE }, (_, index) => index)
  const COUNTER_FROM = 40
  const BUTTON_EXAMPLE = 'e.g. needs a hard press to register, misses holds'
  const STATION_EXAMPLE = 'e.g. screen is black, card reader does nothing'

  const id = $props.id()
  const queryClient = useQueryClient()
  const drafts = new Map<string, Draft>()
  const delivered = new Set<string>()

  let open = $state(false)
  let target = $state<CardTarget | null>(null)
  let draft = $state<Draft>({ kind: null, text: '' })
  let hint = $state('')
  let sending = $state(false)
  let tipOpen = $state(false)
  let sent = false
  let sendId = 0
  let choices = $state<HTMLElement | null>(null)
  let textarea = $state<HTMLTextAreaElement | null>(null)

  const targetKey = (card: CardTarget): string =>
    card.kind === 'one' ? buttonKey(card.ref) : `${card.lineId}/${card.cab}/whole`

  const one = $derived(target?.kind === 'one' ? target.ref : null)
  const station = $derived(target?.kind === 'wholeCab' || (one !== null && isStation(one)))
  const kindLabel = $derived(station ? stationKindLabel : KIND_LABEL)
  const current = $derived(one ? states.get(buttonKey(one)) : undefined)
  const status = $derived(current?.status ?? 'good')
  const confirmed = $derived(current?.confirmed ?? 'good')
  const cabName = $derived.by(() => {
    if (!target) return ''
    const where = target.kind === 'one' ? target.ref : target
    const line = findLine(where.lineId)
    return line ? cabinetLabel(line, where.cab) : ''
  })
  const title = $derived.by(() => {
    if (!target) return ''
    if (target.kind === 'wholeCab') return `${cabName}, whole cab`
    const { side, button } = target.ref
    if (isStation(target.ref)) return `${cabName}, ${side}P side`
    return `${side}P button ${button}: ${STATUS_LABEL[confirmed]}`
  })
  const description = $derived.by(() => {
    if (!target) return ''
    if (target.kind === 'wholeCab') return 'Your report goes to both sides.'
    return isStation(target.ref) ? `Status: ${stationStatusLabel[confirmed]}` : cabName
  })
  const miniLabel = $derived(one ? `${one.side}P` : 'Both')
  const left = $derived(DESCRIPTION_MAX - draft.text.length)

  export function show(card: CardTarget): void {
    target = card
    draft = { ...(drafts.get(targetKey(card)) ?? { kind: null, text: '' }) }
    hint = ''
    tipOpen = false
    sending = false
    sent = false
    delivered.clear()
    sendId += 1
    open = true
  }

  function remember(): void {
    if (target) drafts.set(targetKey(target), { kind: draft.kind, text: draft.text })
  }

  function pick(kind: ReportKind): void {
    if (kind !== draft.kind) delivered.clear()
    draft.kind = kind
    hint = ''
    remember()
    void tick().then(() => textarea?.focus({ preventScroll: true }))
  }

  function setText(text: string): void {
    draft.text = text
    if (text.trim()) hint = ''
    remember()
  }

  async function sendOne(
    ref: ButtonRef,
    kind: ReportKind,
    text: string,
    onCard: () => boolean
  ): Promise<SendResult> {
    const { deviceId, turnstileToken } = await writerFields(queryClient)
    if (!onCard()) return { kind: 'abandoned' }
    const response = await apiRequest(PostButtonReport, {
      lineId: ref.lineId,
      cab: ref.cab,
      side: ref.side,
      button: ref.button,
      kind,
      description: text,
      deviceId,
      turnstileToken,
    })
    const noun = isStation(ref) ? 'side' : 'button'
    switch (response.kind) {
      case 'goodButtonReport':
        storeButton(queryClient, response.data.button)
        return { kind: 'sent' }
      case 'badButtonCooldown': {
        const wait = retryText(response.data.retryAfterMs)
        return { kind: 'refused', hint: `You reported this ${noun} a few minutes ago. ${wait}` }
      }
      case 'badTooManyButtonReports':
        return {
          kind: 'refused',
          hint: `You've sent a lot of reports. ${retryText(response.data.retryAfterMs)}`,
        }
      case 'badValidation':
      case 'badCaptcha':
      case 'badUnknownButton':
        return { kind: 'refused', hint: response.message }
    }
  }

  function checkDraft(kind: ReportKind): string | null {
    const checked = checkDescription(kind, draft.text)
    if (checked.ok) return checked.description
    hint =
      checked.problem === 'required'
        ? 'Add a short description.'
        : `Keep it to ${DESCRIPTION_MAX} characters.`
    nudge(textarea, { preventScroll: true })
    return null
  }

  async function send(): Promise<void> {
    const card = target
    const kind = draft.kind
    if (sending || !card || !kind) return
    const text = checkDraft(kind)
    if (text === null) return
    const mine = ++sendId
    const onCard = (): boolean => open && sendId === mine
    const refs = refsOf(card)
    const sentHere: ButtonRef[] = []
    const reportPartial = (): void => {
      const [first] = sentHere
      if (first && sentHere.length < refs.length) {
        toast.error(`${first.side}P side sent. Report the other side again.`)
      }
    }
    sending = true
    hint = ''
    try {
      for (const ref of refs) {
        if (delivered.has(buttonKey(ref))) continue
        // oxlint-disable-next-line no-await-in-loop -- 2P is only sent once 1P went through
        const result = await sendOne(ref, kind, text, onCard)
        if (result.kind === 'abandoned') {
          reportPartial()
          return
        }
        if (result.kind === 'refused') {
          if (onCard()) hint = refs.length > 1 ? `${ref.side}P side: ${result.hint}` : result.hint
          return
        }
        sentHere.push(ref)
        if (onCard()) delivered.add(buttonKey(ref))
      }
      drafts.delete(targetKey(card))
      if (!onCard()) {
        toast.thanks()
        return
      }
      sent = true
      open = false
    } catch (error) {
      if (!onCard()) {
        reportPartial()
        return
      }
      console.error('Could not send a button report', error)
      hint = hintForError(error)
    } finally {
      if (sendId === mine) sending = false
    }
  }

  function sendOnEnter(event: KeyboardEvent): void {
    if (event.isComposing || event.keyCode === 229) return
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    void send()
  }
</script>

<Dialog
  bind:open
  {title}
  {description}
  presentation="card"
  initialFocus={() => (draft.kind ? textarea : (choices?.querySelector('button') ?? null))}
  onExitComplete={() => {
    if (sent) toast.thanks()
    if (target) onclosed(target, sent)
  }}
>
  {#snippet leading()}
    {#if target}
      <MiniStation
        label={miniLabel}
        button={one?.button ?? STATION}
        status={station ? confirmed : status}
      />
    {/if}
  {/snippet}

  {#snippet subtitle()}
    {#if current?.pending}
      {@const proposed = current.pending}
      {@const votes = current.pendingVotes}
      <pending-line>
        <FaceIcon status={statusOfKind(proposed)} faded />
        {#if votes < AGREE_PEOPLE}
          <span>{kindLabel[proposed]}?</span>
          <vote-pips role="img" aria-label="{votes} of {AGREE_PEOPLE} reports">
            {#each PIPS as pip (pip)}
              <i data-on={pip < votes ? '' : undefined}></i>
            {/each}
          </vote-pips>
        {:else}
          <span>{votes} say {kindLabel[proposed]}</span>
        {/if}
        <info-tip data-open={tipOpen ? '' : undefined}>
          <button
            type="button"
            data-touch
            aria-label="How status changes"
            aria-describedby="{id}-tip"
            aria-expanded={tipOpen}
            onclick={() => (tipOpen = !tipOpen)}
            onblur={() => (tipOpen = false)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <circle
                cx="10"
                cy="10"
                r="8.2"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              />
              <circle cx="10" cy="6.3" r="1.15" fill="currentColor" />
              <path
                d="M10 9.2v5.2"
                stroke="currentColor"
                stroke-width="1.9"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <span id="{id}-tip" role="tooltip">
            A {station ? "side's" : "button's"} status changes when {AGREE_PEOPLE} people agree.
          </span>
        </info-tip>
      </pending-line>
    {/if}
  {/snippet}

  {#if current && current.recent.length > 0}
    <ul>
      {#each current.recent as report (report.at)}
        <li>
          <report-kind>
            <FaceIcon status={statusOfKind(report.kind)} />{kindLabel[report.kind]}
          </report-kind>
          {#if report.description}
            <q>{report.description}</q>
          {/if}
          <time datetime={new Date(report.at).toISOString()}>
            {formatAge(new Date(report.at), clock.now)}
          </time>
        </li>
      {/each}
    </ul>
  {/if}

  <card-ask>How does it play?</card-ask>
  <kind-choices bind:this={choices}>
    {#each REPORT_KINDS as kind (kind)}
      <button
        type="button"
        aria-pressed={draft.kind === kind}
        disabled={sending}
        onclick={() => pick(kind)}
      >
        <FaceIcon status={statusOfKind(kind)} />
        <span>{kindLabel[kind]}</span>
      </button>
    {/each}
  </kind-choices>

  {#if draft.kind}
    {@const required = needsDescription(draft.kind)}
    <problem-fields>
      <label>
        <span>{required ? "What's going on?" : 'Anything to add? (optional)'}</span>
        <textarea
          bind:this={textarea}
          bind:value={() => draft.text, setText}
          rows="2"
          maxlength={DESCRIPTION_MAX}
          enterkeyhint="send"
          placeholder={station ? STATION_EXAMPLE : BUTTON_EXAMPLE}
          aria-required={required}
          aria-invalid={hint ? 'true' : undefined}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onkeydown={sendOnEnter}
          {@attach nudgeable}
        ></textarea>
        {#if left <= COUNTER_FROM}
          <small>{left} left</small>
        {/if}
      </label>
      {#if hint}
        <p id="{id}-hint" role="alert">{hint}</p>
      {/if}
      <button
        type="button"
        data-variant="primary"
        disabled={sending}
        aria-busy={sending}
        onclick={() => void send()}
      >
        <span>Send report</span>
        {#if sending}<busy-ring aria-hidden="true"></busy-ring>{/if}
      </button>
    </problem-fields>
  {/if}
  <turnstile-mount {@attach turnstileHost}></turnstile-mount>
</Dialog>

<style>
  pending-line {
    --face-size: 1.1rem;

    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    margin-block-start: 0.1rem;
    font-size: 0.88rem;
    font-weight: var(--weight-heavy);
    color: var(--muted);
  }

  vote-pips {
    display: inline-flex;
    gap: 0.25rem;
    margin-inline-start: 0.2rem;

    & i {
      inline-size: 0.5rem;
      block-size: 0.5rem;
      border-radius: 50%;
      box-shadow: inset 0 0 0 1.5px var(--muted);

      &[data-on] {
        background: var(--muted);
        box-shadow: none;
      }
    }
  }

  info-tip {
    position: relative;
    display: inline-flex;
    margin-inline-start: 0.1rem;

    & button {
      display: inline-grid;
      place-items: center;
      inline-size: 1.3rem;
      block-size: 1.3rem;
      padding: 0;
      color: var(--muted);
      background: transparent;
      border: 0;
      border-radius: 50%;
    }

    & svg {
      inline-size: 1.05rem;
      block-size: 1.05rem;
    }
  }

  [role='tooltip'] {
    position: absolute;
    inset-block-start: calc(100% + 0.45rem);
    inset-inline-start: 50%;
    z-index: 3;
    inline-size: max-content;
    max-inline-size: 13rem;
    padding: 0.5rem 0.7rem;
    font-size: 0.8rem;
    font-weight: var(--weight-regular);
    line-height: 1.35;
    color: var(--card);
    background: var(--ink);
    border-radius: 0.65rem;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    translate: -50% -3px;

    &::before {
      position: absolute;
      inset-block-end: 100%;
      inset-inline-start: 50%;
      content: '';
      border: 6px solid transparent;
      border-block-end-color: var(--ink);
      translate: -50% 0;
    }
  }

  info-tip[data-open] [role='tooltip'],
  info-tip button:focus-visible + [role='tooltip'] {
    opacity: 1;
    visibility: visible;
    translate: -50% 0;
  }

  @media (hover: hover) {
    info-tip:hover [role='tooltip'] {
      opacity: 1;
      visibility: visible;
      translate: -50% 0;
    }
  }

  ul {
    display: grid;
    gap: 0.4rem;
  }

  li {
    display: grid;
    grid-template-columns: 6.6rem minmax(0, 1fr);
    gap: 0.1rem 0.6rem;
    padding: 0.55rem 0.7rem;
    font-size: 0.86rem;
    background: var(--bg);
    border-radius: 0.75rem;
  }

  report-kind {
    --face-size: 1.1rem;

    display: inline-flex;
    grid-row: span 2;
    align-items: center;
    align-self: start;
    gap: 0.3rem;
    font-weight: var(--weight-heavy);
  }

  q {
    overflow-wrap: anywhere;
    quotes: none;
  }

  time {
    font-size: 0.78rem;
    color: var(--muted);
  }

  card-ask {
    display: block;
    margin-block-start: 0.2rem;
    font-weight: var(--weight-heavy);
  }

  kind-choices {
    --face-size: 1.7rem;

    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;

    & button {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.7rem 0.3rem;
      font-size: 0.8rem;
      font-weight: var(--weight-heavy);
      line-height: 1.2;
      color: var(--ink);
      background: var(--bg);
      border: 0;
      border-radius: 0.9rem;

      &[aria-pressed='true'] {
        box-shadow: inset 0 0 0 2px var(--ink);
      }

      &:disabled {
        cursor: default;
      }
    }
  }

  problem-fields {
    display: grid;
    gap: 0.85rem;
  }

  label {
    display: grid;
    gap: 0.3rem;
    font-size: 0.9rem;
    font-weight: var(--weight-heavy);
  }

  textarea {
    min-block-size: 3.2rem;
    max-block-size: 9rem;
    field-sizing: content;
    padding: 0.65rem 0.8rem;
    font-size: 0.95rem;
    font-weight: var(--weight-regular);
    color: var(--ink);
    background: var(--bg);
    border: 0;
    border-radius: 0.8rem;
    resize: none;

    &:focus-visible {
      outline: var(--focus-ring);
      outline-offset: 1px;
    }

    &[aria-invalid='true'] {
      box-shadow: inset 0 0 0 2px var(--err);
    }
  }

  small {
    justify-self: end;
    font-size: 0.78rem;
    font-weight: var(--weight-regular);
    color: var(--muted);
  }

  [role='alert'] {
    font-size: 0.85rem;
    font-weight: var(--weight-heavy);
    color: var(--err);
  }

  [data-variant='primary'] {
    padding: 0.9rem 1.5rem;
  }

  turnstile-mount {
    display: contents;
  }

  @media (prefers-reduced-motion: no-preference) {
    [role='tooltip'] {
      transition:
        opacity 150ms var(--ease-out),
        visibility 150ms,
        translate 150ms var(--ease-out);
    }

    problem-fields {
      animation: m-rise 240ms var(--ease-out);
    }

    textarea:global([data-nudge]) {
      animation: m-nudge 360ms var(--ease-out);
    }

    @media (hover: hover) {
      kind-choices button:not(:disabled):hover {
        transform: translateY(-1px);
      }
    }
  }
</style>
