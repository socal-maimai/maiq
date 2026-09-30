<script lang="ts">
  import {
    buttonKey,
    STATION,
    STATUS_LABEL,
    stationStatusLabel,
    type ButtonRef,
    type ButtonStatus,
    type Side,
    type StatusPair,
  } from '@maiq/core/buttons'
  import { RING_SLOTS } from '@maiq/core/station'
  import FaceMarks from '$lib/components/face-marks.svelte'

  type StatusOf = (ref: ButtonRef) => StatusPair

  type Props = {
    lineId: string
    cab: number
    side: Side
    statusOf: StatusOf
    selectedKeys: readonly string[]
    poppedKeys: readonly string[]
    onpick: (ref: ButtonRef) => void
    onpopped: (key: string) => void
  }

  let { lineId, cab, side, statusOf, selectedKeys, poppedKeys, onpick, onpopped }: Props =
    $props()

  const buttons = $derived(
    RING_SLOTS.map(slot => {
      const ref: ButtonRef = { lineId, cab, side, button: slot.button }
      return { slot, ref, key: buttonKey(ref), status: statusOf(ref).status }
    })
  )

  const station = $derived.by(() => {
    const ref: ButtonRef = { lineId, cab, side, button: STATION }
    return { ref, key: buttonKey(ref), ...statusOf(ref) }
  })
  const down = $derived(station.confirmed === 'broken')
  const pending = $derived(station.status === 'pending')
  const badge = $derived<ButtonStatus>(pending ? 'pending' : station.confirmed)
  const spoken = $derived(
    pending && station.confirmed !== 'good'
      ? `${stationStatusLabel[station.confirmed]}, pending`
      : stationStatusLabel[station.status]
  )

  const LAST = RING_SLOTS.length
  let active = $state(0)

  const STEPS: Record<string, (index: number) => number> = {
    ArrowRight: index => (index + 1) % (LAST + 1),
    ArrowDown: index => (index + 1) % (LAST + 1),
    ArrowLeft: index => (index + LAST) % (LAST + 1),
    ArrowUp: index => (index + LAST) % (LAST + 1),
    Home: () => 0,
    End: () => LAST,
  }

  function onKey(
    event: KeyboardEvent & { currentTarget: SVGGElement },
    index: number,
    ref: ButtonRef
  ): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onpick(ref)
      return
    }
    const step = STEPS[event.key]
    if (!step) return
    event.preventDefault()
    active = step(index)
    const ring = event.currentTarget.ownerSVGElement
    ring?.querySelectorAll<SVGGElement>('[role="button"]')[active]?.focus()
  }
</script>

<svg
  viewBox="0 0 200 200"
  role="toolbar"
  aria-label="{side}P side and buttons"
  data-down={down ? '' : undefined}
>
  <circle cx="100" cy="100" r="99" data-part="bezel" />
  <circle cx="100" cy="100" r="68" data-part="rim" />
  <g
    role="button"
    tabindex={active === 0 ? 0 : -1}
    aria-label="{side}P side: {spoken}"
    aria-pressed={selectedKeys.includes(station.key)}
    data-part="side"
    data-pop={poppedKeys.includes(station.key) ? '' : undefined}
    onclick={() => onpick(station.ref)}
    onfocus={() => (active = 0)}
    onkeydown={event => onKey(event, 0, station.ref)}
    onanimationend={() => onpopped(station.key)}
  >
    <circle cx="100" cy="100" r="61" data-part="screen" />
    <text x="100" y="97" text-anchor="middle" data-status={station.confirmed}>
      {down ? 'Down' : `${side}P`}
    </text>
    <g transform="translate(89 104) scale(1.1)">
      <circle cx="10" cy="10" r="9.2" data-part="badge" data-status={badge} />
      <FaceMarks status={badge} />
    </g>
  </g>
  {#each buttons as { slot, ref, key, status } (slot.button)}
    <g
      role="button"
      tabindex={active === slot.button ? 0 : -1}
      aria-label="{side}P button {slot.button}: {STATUS_LABEL[status]}"
      aria-pressed={selectedKeys.includes(key)}
      data-part="slot"
      data-pop={poppedKeys.includes(key) ? '' : undefined}
      onclick={() => onpick(ref)}
      onfocus={() => (active = slot.button)}
      onkeydown={event => onKey(event, slot.button, ref)}
      onanimationend={() => onpopped(key)}
    >
      <polygon points={slot.points} data-part="hit" />
      <polygon points={slot.points} data-part="key" data-status={status} />
      <g transform={slot.faceAt}>
        <FaceMarks {status} />
      </g>
    </g>
  {/each}
</svg>

<style>
  svg {
    inline-size: 100%;
    max-inline-size: 11rem;
    block-size: auto;
  }

  [data-part='bezel'] {
    fill: var(--cab-bezel);
  }

  [data-part='rim'] {
    fill: var(--cab-rim);
  }

  [data-part='screen'] {
    fill: var(--cab-screen);
  }

  [data-part='badge'] {
    fill: var(--tone);
  }

  text {
    font-family: inherit;
    font-size: 26px;
    font-weight: var(--weight-heavy);
    fill: var(--tone, var(--muted));
  }

  g[role='button'] {
    cursor: pointer;
    outline: none;
  }

  svg[data-down] g[data-part='slot'] {
    opacity: 0.35;
  }

  [data-part='side'] {
    transform-box: fill-box;
    transform-origin: center;
  }

  [data-part='side']:focus-visible [data-part='screen'],
  [data-part='side'][aria-pressed='true'] [data-part='screen'] {
    stroke: var(--ink);
    stroke-width: 3.5;
  }

  [data-part='hit'] {
    fill: none;
    stroke: transparent;
    stroke-width: 20;
    stroke-linejoin: round;
    pointer-events: stroke;
  }

  [data-part='key'] {
    stroke: var(--cab-rim);
    stroke-width: 2.5;
    stroke-linejoin: round;
    transform-box: fill-box;
    transform-origin: center;
    fill: var(--tone);
  }

  g[role='button']:focus-visible [data-part='key'],
  g[aria-pressed='true'] [data-part='key'] {
    stroke: var(--ink);
    stroke-width: 3.5;
  }

  @media (prefers-reduced-motion: no-preference) {
    [data-part='key'],
    [data-part='side'] {
      transition: transform 160ms var(--ease-out);
    }

    g[data-part='slot']:active [data-part='key'],
    [data-part='side']:active {
      transform: scale(0.95);
    }

    g[data-part='slot'][data-pop] [data-part='key'],
    [data-part='side'][data-pop] {
      animation: m-bump 380ms var(--ease-out);
    }

    @media (hover: hover) {
      g[data-part='slot']:hover [data-part='key'] {
        transform: scale(1.04);
      }

      [data-part='side']:hover {
        transform: scale(1.03);
      }
    }
  }
</style>
