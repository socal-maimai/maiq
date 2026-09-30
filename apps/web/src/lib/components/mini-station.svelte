<script lang="ts">
  import { isStation, type ButtonStatus } from '@maiq/core/buttons'
  import { MINI_SLOTS } from '@maiq/core/station'

  type Props = { label: string; button: number; status: ButtonStatus }

  let { label, button, status }: Props = $props()

  const station = $derived(isStation({ button }))
</script>

<svg viewBox="0 0 200 200" aria-hidden="true">
  <circle cx="100" cy="100" r="99" data-part="bezel" />
  <circle cx="100" cy="100" r="56" data-part="screen" />
  {#each MINI_SLOTS as slot (slot.button)}
    <polygon points={slot.points} data-status={slot.button === button ? status : undefined} />
  {/each}
  <text x="100" y="114" text-anchor="middle" data-status={station ? status : undefined}>
    {label}
  </text>
</svg>

<style>
  svg {
    flex: none;
    align-self: center;
    inline-size: 3.8rem;
    block-size: 3.8rem;
  }

  [data-part='bezel'] {
    fill: var(--cab-bezel);
  }

  [data-part='screen'] {
    fill: var(--cab-screen);
  }

  text {
    font-family: inherit;
    font-size: 40px;
    font-weight: var(--weight-heavy);
    fill: var(--muted);

    &[data-status='unreliable'],
    &[data-status='broken'] {
      fill: var(--tone);
    }
  }

  polygon {
    fill: var(--cab-idle);
    stroke: var(--cab-rim);
    stroke-width: 3;
    stroke-linejoin: round;

    &[data-status] {
      fill: var(--tone);
    }
  }
</style>
