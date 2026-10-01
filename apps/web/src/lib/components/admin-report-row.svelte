<script lang="ts" module>
  export type AdminRow = {
    key: string
    at: number
    line: string
    summary: string
    detail: string
    reporter: string
    reporterName: string | null
    verified: boolean
    hidden: boolean
    test: boolean
    muted: boolean
  }

  const TIME = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  const shortReporter = (reporter: string, name: string | null): string => {
    const [kind, id = ''] = reporter.split(':')
    if (kind === 'device') return `web ${id.slice(0, 8)}`
    return name ? `@${name}` : `${kind} ${id}`
  }
</script>

<script lang="ts">
  type Props = {
    row: AdminRow
    busy: boolean
    onHide: (hidden: boolean) => void
    onMute: (muted: boolean) => void
  }

  let { row, busy, onHide, onMute }: Props = $props()
</script>

<li data-hidden={row.hidden ? '' : undefined}>
  <report-main>
    <report-head>
      <strong>{row.line}</strong>
      <time datetime={new Date(row.at).toISOString()}>{TIME.format(row.at)}</time>
    </report-head>
    <p>{row.summary}</p>
    {#if row.detail}<p data-detail>{row.detail}</p>{/if}
    <report-tags>
      <span title={row.reporter}>{shortReporter(row.reporter, row.reporterName)}</span>
      {#if row.verified}<span data-tone="verified">at arcade</span>{/if}
      {#if row.test}<span data-tone="test">test</span>{/if}
      {#if row.hidden}<span data-tone="hidden">hidden</span>{/if}
      {#if row.muted}<span data-tone="hidden">muted</span>{/if}
    </report-tags>
  </report-main>
  <report-actions>
    <button type="button" disabled={busy} onclick={() => onHide(!row.hidden)}>
      {row.hidden ? 'Unhide' : 'Hide'}
    </button>
    {#if !row.test}
      <button type="button" disabled={busy} onclick={() => onMute(!row.muted)}>
        {row.muted ? 'Unmute' : 'Mute'}
      </button>
    {/if}
  </report-actions>
</li>

<style>
  li {
    display: flex;
    gap: 0.75rem;
    align-items: start;
    justify-content: space-between;
    padding: 0.85rem 1rem;
    background: var(--card);
    border-radius: 1rem;

    &[data-hidden] report-main {
      opacity: 0.55;
    }
  }

  report-main {
    display: grid;
    gap: 0.3rem;
    min-inline-size: 0;
  }

  report-head {
    display: flex;
    flex-wrap: wrap;
    gap: 0 0.6rem;
    align-items: baseline;
  }

  time,
  [data-detail] {
    font-size: 0.85rem;
    color: var(--muted);
  }

  p {
    margin: 0;
    overflow-wrap: anywhere;
  }

  report-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;

    & span {
      padding: 0.1rem 0.55rem;
      font-size: 0.8rem;
      color: var(--muted);
      background: var(--bg);
      border-radius: var(--radius-pill);
    }

    & [data-tone='verified'] {
      color: var(--verified-ink);
      background: var(--verified);
    }

    & [data-tone='test'] {
      color: var(--warning-ink);
      background: var(--warning-bg);
    }

    & [data-tone='hidden'] {
      color: var(--issue-broken-ink);
      background: var(--issue-broken-bg);
    }
  }

  report-actions {
    display: grid;
    flex-shrink: 0;
    gap: 0.4rem;

    & button {
      min-block-size: 2.25rem;
      padding: 0.3rem 0.9rem;
      font-weight: var(--weight-heavy);
      background: var(--bg);
      border: 0;
      border-radius: var(--radius-pill);

      &:disabled {
        opacity: 0.45;
        cursor: default;
      }
    }
  }
</style>
