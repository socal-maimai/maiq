<svelte:options namespace="svg" />

<script lang="ts">
  import type { ButtonStatus } from '@maiq/core/buttons'
  import { FACE_EYES, FACE_MOUTHS } from '@maiq/core/face'

  type Props = { status: ButtonStatus }

  let { status }: Props = $props()
</script>

<g data-status={status}>
  {#each FACE_EYES as eye}
    <circle {...eye} />
  {/each}
  <path d={FACE_MOUTHS[status]} />
</g>

<style>
  g {
    color: var(--face-ink);

    &[data-status='unreliable'] {
      color: var(--face-ink-unreliable);
    }
  }

  circle {
    fill: currentColor;
  }

  path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
