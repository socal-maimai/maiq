<script lang="ts">
  import CabinetGlyph from '$lib/components/cabinet-glyph.svelte'

  type Props = { cabs: number }

  let { cabs }: Props = $props()

  const label = $derived(`${cabs} ${cabs === 1 ? 'cabinet' : 'cabinets'}`)
</script>

<cab-pill role="img" aria-label={label} title={label}>
  <CabinetGlyph />
  <span>×{cabs}</span>
</cab-pill>

<style>
  cab-pill {
    display: inline-block;
    flex: none;
    padding: 0 0.5rem 0 0.35rem;
    font-size: 0.78rem;
    font-weight: var(--weight-heavy);
    line-height: 1.4rem;
    white-space: nowrap;
    color: var(--pink);
    background: var(--pink-soft);
    border-radius: var(--radius-pill);
  }

  cab-pill :global(svg) {
    display: inline-block;
    inline-size: 1.6cap;
    block-size: 1.6cap;
    margin-inline-end: 0.2rem;
    vertical-align: calc((1cap - 1.6cap) / 2);
  }

  @media (max-width: 370px) {
    cab-pill {
      padding-inline: 0.25rem 0.4rem;
      font-size: 0.72rem;
    }

    cab-pill :global(svg) {
      margin-inline-end: 0.12rem;
    }
  }
</style>
