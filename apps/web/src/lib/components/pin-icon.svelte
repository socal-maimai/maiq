<script lang="ts">
  type Props = { shine?: boolean }

  let { shine = false }: Props = $props()

  const PIN =
    'M12 2.5c-4.1 0-7.3 3.1-7.3 7.1 0 5 6.2 11.2 6.6 11.6.4.4 1 .4 1.4 0' +
    ' .4-.4 6.6-6.6 6.6-11.6 0-4-3.2-7.1-7.3-7.1z'
</script>

<svg viewBox="0 0 24 24" aria-hidden="true">
  <path d={PIN} />
  <circle cx="12" cy="9.6" r="2.9" />
  {#if shine}
    <circle cx="8.6" cy="6.4" r="1.1" data-part="shine" />
  {/if}
</svg>

<style>
  path {
    fill: currentColor;
  }

  circle {
    fill: var(--on-pink);
  }

  [data-part='shine'] {
    opacity: 0.55;
  }
</style>
