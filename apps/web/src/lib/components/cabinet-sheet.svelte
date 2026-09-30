<script lang="ts">
  import { findArcade, type Arcade } from '@maiq/core/arcades'
  import {
    BUTTON_STATUSES,
    buttonKey,
    cabinetsOf,
    SIDES,
    STATION,
    STATUS_LABEL,
    type ButtonRef,
    type Cabinet,
    type ConfirmedStatus,
    type StatusPair,
    UNREPORTED,
  } from '@maiq/core/buttons'
  import type { ButtonStateJson } from '@maiq/types'
  import ButtonCard, { refsOf, type CardTarget } from '$lib/components/button-card.svelte'
  import CabinetGlyph from '$lib/components/cabinet-glyph.svelte'
  import FaceIcon from '$lib/components/face-icon.svelte'
  import StationRing from '$lib/components/station-ring.svelte'
  import Dialog from '$lib/ui/dialog.svelte'

  type Props = { buttons: readonly ButtonStateJson[] }

  let { buttons }: Props = $props()

  let open = $state(false)
  let arcade = $state<Arcade | undefined>(undefined)
  let selectedKeys = $state<string[]>([])
  let poppedKeys = $state<string[]>([])
  let card = $state<ReturnType<typeof ButtonCard> | null>(null)

  const states = $derived(new Map(buttons.map(button => [buttonKey(button), button])))
  const cabinets = $derived(arcade ? cabinetsOf(arcade) : [])
  const statusOf = (ref: ButtonRef): StatusPair => states.get(buttonKey(ref)) ?? UNREPORTED
  const keysOf = (target: CardTarget): string[] => refsOf(target).map(buttonKey)

  const SEVERITY: Record<ConfirmedStatus, number> = { good: 0, unreliable: 1, broken: 2 }

  function cabStatus(cabinet: Cabinet): ConfirmedStatus {
    const [first, second] = SIDES.map(
      side =>
        statusOf({ lineId: cabinet.line.id, cab: cabinet.cab, side, button: STATION }).confirmed
    )
    if (!first || !second) return 'good'
    return SEVERITY[first] >= SEVERITY[second] ? first : second
  }

  export function show(arcadeId: string): void {
    arcade = findArcade(arcadeId)
    selectedKeys = []
    poppedKeys = []
    open = true
  }

  function pick(target: CardTarget): void {
    selectedKeys = keysOf(target)
    card?.show(target)
  }

  function cardClosed(target: CardTarget, sent: boolean): void {
    selectedKeys = []
    if (!sent) return
    poppedKeys = keysOf(target)
  }

  function popped(key: string): void {
    poppedKeys = poppedKeys.filter(other => other !== key)
  }
</script>

<Dialog
  bind:open
  title={arcade?.name ?? ''}
  description="Tap a button or a screen to see reports or add one."
  presentation="drawer"
>
  {#snippet toolbar()}
    <status-legend>
      {#each BUTTON_STATUSES as status (status)}
        <span><FaceIcon {status} />{STATUS_LABEL[status]}</span>
      {/each}
    </status-legend>
  {/snippet}

  <cab-list>
    {#each cabinets as cabinet (`${cabinet.line.id}/${cabinet.cab}`)}
      <section aria-label={cabinet.label}>
        <cab-heading>
          <h3>{cabinet.label}</h3>
          <button
            type="button"
            data-touch
            aria-label="Report the whole {cabinet.label}"
            title="Report the whole cab"
            data-status={cabStatus(cabinet)}
            onclick={() => pick({ kind: 'wholeCab', lineId: cabinet.line.id, cab: cabinet.cab })}
          >
            <CabinetGlyph />
          </button>
        </cab-heading>
        <cab-stations>
          {#each SIDES as side (side)}
            <StationRing
              lineId={cabinet.line.id}
              cab={cabinet.cab}
              {side}
              {statusOf}
              {selectedKeys}
              {poppedKeys}
              onpick={ref => pick({ kind: 'one', ref })}
              onpopped={popped}
            />
          {/each}
        </cab-stations>
      </section>
    {/each}
  </cab-list>
</Dialog>

<ButtonCard bind:this={card} {states} onclosed={cardClosed} />

<style>
  status-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.8rem;
    font-size: 0.85rem;
    color: var(--muted);

    & span {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
  }

  cab-list {
    display: grid;
    gap: 0.75rem;
  }

  section {
    display: grid;
    gap: 0.6rem;
    padding: 0.85rem;
    background: var(--bg);
    border-radius: 1rem;
  }

  cab-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  h3 {
    font-size: 1rem;
  }

  cab-stations {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-items: center;
    gap: 0.6rem;
  }

  cab-heading > button {
    display: grid;
    flex: none;
    place-items: center;
    inline-size: 2rem;
    block-size: 2rem;
    padding: 0;
    color: var(--tone);
    background: color-mix(in srgb, var(--tone) 16%, transparent);
    border: 0;
    border-radius: var(--radius-pill);

    & :global(svg) {
      inline-size: 1.05rem;
      block-size: 1.05rem;
    }
  }

  @media (hover: hover) {
    cab-heading > button:hover {
      background: color-mix(in srgb, var(--tone) 26%, transparent);
    }
  }
</style>
