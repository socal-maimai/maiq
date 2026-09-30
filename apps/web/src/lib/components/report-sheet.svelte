<script lang="ts">
  import {
    ARCADES,
    findArcade,
    findLine,
    lineName,
    soleLine,
    sortByDistance,
    type Line,
  } from '@maiq/core/arcades'
  import { cabsText, checkCount, MAX_QUEUE, maxPlayers } from '@maiq/core/caps'
  import { distanceMiles, FAR_MILES, formatMiles } from '@maiq/core/geo'
  import { retryText } from '@maiq/core/retry'
  import { PostReport } from '@maiq/types'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { apiRequest } from '$lib/api'
  import { hintForError } from '$lib/api-error'
  import { nudge, nudgeable } from '$lib/nudge'
  import { storeLine } from '$lib/query'
  import { toast } from '$lib/toast'
  import { turnstileHost } from '$lib/turnstile'
  import Combobox from '$lib/ui/combobox.svelte'
  import Dialog from '$lib/ui/dialog.svelte'
  import { viewer } from '$lib/viewer.svelte'
  import { writerFields } from '$lib/writes'

  type Errors = { players?: string; queue?: string; form?: string }

  const id = $props.id()
  const queryClient = useQueryClient()

  let open = $state(false)
  let arcadeId = $state<string | null>(null)
  let chosenLineId = $state<string | null>(null)
  let players = $state('')
  let queue = $state('')
  let errors = $state<Errors>({})
  let submitting = $state(false)
  let playersInput = $state<HTMLInputElement | null>(null)
  let queueInput = $state<HTMLInputElement | null>(null)

  const items = $derived.by(() => {
    const origin = viewer.origin
    const arcades = origin.kind === 'none' ? ARCADES : sortByDistance(origin.point)
    return arcades.map(arcade => ({ value: arcade.id, label: arcade.name }))
  })

  const arcade = $derived(arcadeId ? findArcade(arcadeId) : undefined)
  const line = $derived.by((): Line | undefined => {
    if (!arcade) return undefined
    return soleLine(arcade) ?? arcade.lines.find(l => l.id === chosenLineId)
  })
  const farMiles = $derived(
    arcade && viewer.position ? distanceMiles(viewer.position, arcade.location) : null
  )

  const wholeNumber = (text: string): number | null =>
    /^\d{1,2}$/.test(text.trim()) ? Number(text.trim()) : null

  function startArcadeId(): string | null {
    const origin = viewer.origin
    if (origin.kind === 'position') return origin.near.id
    return origin.kind === 'home' ? origin.arcade.id : null
  }

  export function show(lineId: string | null = null): void {
    const preset = lineId ? findLine(lineId) : undefined
    arcadeId = preset?.arcadeId ?? startArcadeId()
    chosenLineId = preset?.id ?? null
    players = ''
    queue = ''
    errors = {}
    open = true
  }

  function pickArcade(next: string | null): void {
    arcadeId = next
    chosenLineId = null
    errors = {}
  }

  function pickLine(next: string): void {
    chosenLineId = next
    errors = {}
  }

  const overCap = (target: Line, max: number): string =>
    `${lineName(target)} has ${cabsText(target)}, so at most ${max} players.`

  function validate(): { players: number; queue: number } | null {
    const next: Errors = {}
    const p = wholeNumber(players)
    const q = wholeNumber(queue)
    if (!arcade) next.form = 'Pick an arcade.'
    else if (!line) next.form = 'Pick which line you are reporting.'
    if (p === null) next.players = 'Enter how many are playing.'
    if (q === null) next.queue = 'Enter how many are waiting.'
    if (line && p !== null && q !== null) {
      const problem = checkCount(line, { players: p, queue: q })
      if (problem === 'playersOverCap') next.players = overCap(line, maxPlayers(line))
      if (problem === 'queueOverCap') next.queue = `The queue can be at most ${MAX_QUEUE}.`
    }
    errors = next
    if (p === null || q === null || Object.keys(next).length > 0) return null
    return { players: p, queue: q }
  }

  function nudgeInvalid(): void {
    if (errors.players) nudge(playersInput)
    else if (errors.queue) nudge(queueInput)
  }

  async function submit(): Promise<void> {
    if (submitting) return
    const count = validate()
    if (!count || !line) {
      nudgeInvalid()
      return
    }
    submitting = true
    try {
      const response = await apiRequest(PostReport, {
        lineId: line.id,
        ...count,
        ...(await writerFields(queryClient)),
      })
      switch (response.kind) {
        case 'goodReport':
          storeLine(queryClient, response.data.line)
          toast.thanks()
          open = false
          return
        case 'badPlayersOverCap':
          errors = { players: overCap(line, response.data.maxPlayers) }
          nudgeInvalid()
          return
        case 'badRateLimit':
          errors = { form: `You just updated this line. ${retryText(response.data.retryAfterMs)}` }
          return
        case 'badValidation':
          errors = { form: `${response.message} (${response.data.reason})` }
          return
        case 'badCaptcha':
        case 'badUnknownLine':
          errors = { form: response.message }
          return
      }
    } catch (error) {
      errors = { form: hintForError(error) }
    } finally {
      submitting = false
    }
  }

  function nextOnEnter(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.isComposing) return
    event.preventDefault()
    queueInput?.focus()
  }
</script>

<Dialog
  bind:open
  title="Update a queue"
  presentation="drawer"
  initialFocus={() => (arcadeId ? playersInput : null)}
>
  <form
    novalidate
    onsubmit={event => {
      event.preventDefault()
      void submit()
    }}
  >
    <Combobox
      {items}
      label="Arcade"
      bind:value={() => arcadeId, pickArcade}
      placeholder="Search arcades"
    />

    {#if arcade && arcade.lines.length > 1}
      <fieldset>
        <legend>Which line?</legend>
        <line-choices>
          {#each arcade.lines as option (option.id)}
            <label>
              <input
                type="radio"
                name="{id}-line"
                value={option.id}
                checked={chosenLineId === option.id}
                onchange={() => pickLine(option.id)}
              />
              {option.label}
            </label>
          {/each}
        </line-choices>
      </fieldset>
    {/if}

    {#if arcade && farMiles !== null && farMiles > FAR_MILES}
      <p data-tone="warning" role="status">
        You're {formatMiles(farMiles)} from {arcade.name}. Reports from far away count less.
      </p>
    {/if}

    <count-fields>
      <label>
        <input
          id="{id}-players"
          bind:this={playersInput}
          bind:value={players}
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="2"
          autocomplete="off"
          enterkeyhint="next"
          aria-invalid={errors.players ? 'true' : undefined}
          aria-describedby={errors.players ? `${id}-players-error` : undefined}
          onkeydown={nextOnEnter}
          {@attach nudgeable}
        />
        <span>Playing</span>
      </label>
      <label>
        <input
          id="{id}-queue"
          bind:this={queueInput}
          bind:value={queue}
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="2"
          autocomplete="off"
          enterkeyhint="send"
          aria-invalid={errors.queue ? 'true' : undefined}
          aria-describedby={errors.queue ? `${id}-queue-error` : undefined}
          {@attach nudgeable}
        />
        <span>Waiting</span>
      </label>
    </count-fields>
    {#if errors.players}
      <p id="{id}-players-error" role="alert">{errors.players}</p>
    {/if}
    {#if errors.queue}
      <p id="{id}-queue-error" role="alert">{errors.queue}</p>
    {/if}
    {#if errors.form}
      <p role="alert">{errors.form}</p>
    {/if}

    <form-actions>
      <button type="button" data-variant="ghost" onclick={() => (open = false)}>Cancel</button>
      <button type="submit" data-variant="primary" disabled={submitting} aria-busy={submitting}>
        <span>Send</span>
        {#if submitting}<busy-ring aria-hidden="true"></busy-ring>{/if}
      </button>
    </form-actions>
    <turnstile-mount {@attach turnstileHost}></turnstile-mount>
  </form>
</Dialog>

<style>
  form {
    display: grid;
    min-inline-size: 0;
    gap: 1.1rem;
  }

  fieldset {
    display: grid;
    min-inline-size: 0;
    gap: 0.5rem;
    padding: 0;
    border: 0;
  }

  legend {
    margin-block-end: 0.5rem;
    padding: 0;
  }

  line-choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
    gap: 0.5rem;

    & label {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.8rem 0.5rem;
      font-weight: var(--weight-heavy);
      font-size: 0.95rem;
      line-height: 1.2;
      text-align: center;
      color: var(--ink);
      background: var(--bg);
      border-radius: 0.9rem;
      cursor: pointer;

      &:has(:checked) {
        box-shadow: inset 0 0 0 2px var(--ink);
      }

      &:has(:focus-visible) {
        outline: var(--focus-ring);
        outline-offset: 2px;
      }
    }

    & input {
      position: absolute;
      inset: 0;
      margin: 0;
      opacity: 0;
      cursor: pointer;
    }
  }

  count-fields {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    min-inline-size: 0;
    gap: 0.75rem;

    & label {
      display: grid;
      gap: 0.35rem;
      text-align: center;
      color: var(--muted);
    }

    & input {
      inline-size: 100%;
      min-inline-size: 0;
      padding: 0.6rem 0;
      font-size: 2.6rem;
      font-weight: var(--weight-heavy);
      font-variant-numeric: tabular-nums;
      text-align: center;
      color: var(--ink);
      background: var(--card);
      border: 2px solid var(--line);
      border-radius: 1rem;

      &[aria-invalid='true'] {
        border-color: var(--err);
      }
    }
  }

  [role='alert'] {
    color: var(--err);
  }

  [data-tone='warning'] {
    margin-block-start: -0.4rem;
    padding: 0.55rem 0.8rem;
    font-size: 0.88rem;
    color: var(--warning-ink);
    background: var(--warning-bg);
    border-radius: 0.8rem;
  }

  form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  button {
    padding: 0.9rem 1.5rem;
    border: 0;
    border-radius: var(--radius-pill);
  }

  [data-variant='ghost'] {
    color: var(--muted);
    background: transparent;
  }

  turnstile-mount {
    display: contents;
  }

  @media (prefers-reduced-motion: no-preference) {
    input:global([data-nudge]) {
      animation: m-nudge 360ms var(--ease-out);
    }
  }
</style>
