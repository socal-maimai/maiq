<script lang="ts">
  import type { ButtonStatus } from '@maiq/core/buttons'
  import FaceMarks from '$lib/components/face-marks.svelte'

  type Props = { status: ButtonStatus; faded?: boolean }

  let { status, faded = false }: Props = $props()
</script>

<svg viewBox="0 0 20 20" aria-hidden="true" data-faded={faded ? '' : undefined}>
  <circle cx="10" cy="10" r="9.2" data-status={status} />
  <FaceMarks {status} />
</svg>

<style>
  svg {
    display: inline-block;
    flex: none;
    inline-size: var(--face-size, 1.1rem);
    block-size: var(--face-size, 1.1rem);
    vertical-align: calc((1cap - var(--face-size, 1.1rem)) / 2);

    &[data-faded] {
      opacity: 0.55;
    }
  }

  circle {
    fill: var(--tone);
  }
</style>
