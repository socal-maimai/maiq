<script lang="ts" module>
  const LOBES = 8
  const STEPS = 160

  const point = (step: number): string => {
    const angle = (step / STEPS) * 2 * Math.PI
    const radius = 10.2 * (1 + 0.085 * Math.cos(LOBES * angle))
    const x = 12 + radius * Math.sin(angle)
    const y = 12 - radius * Math.cos(angle)
    return `${x.toFixed(2)} ${y.toFixed(2)}`
  }

  const LABEL = 'This report was location-verified.'

  const SCALLOP = `M${Array.from({ length: STEPS }, (_, step) => point(step)).join('L')}Z`
</script>

<verified-badge role="img" aria-label={LABEL} title={LABEL}>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={SCALLOP} data-part="seal" />
    <path d="M7.6 12.3l3 3 5.8-6.4" data-part="check" />
  </svg>
</verified-badge>

<style>
  verified-badge {
    position: absolute;
    inset-block-start: -0.55rem;
    inset-inline-end: -0.55rem;
    display: block;
    inline-size: 1.9rem;
    block-size: 1.9rem;
    line-height: 0;
    rotate: 12deg;
    filter: drop-shadow(0 2px 3px rgb(0 0 0 / 0.18));
  }

  svg {
    inline-size: 100%;
    block-size: 100%;
  }

  [data-part='seal'] {
    fill: var(--verified);
  }

  [data-part='check'] {
    fill: none;
    stroke: var(--verified-ink);
    stroke-width: 2.4;
    stroke-linecap: square;
    stroke-linejoin: miter;
  }
</style>
