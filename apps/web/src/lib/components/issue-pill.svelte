<script lang="ts">
  import type { IssueStatus } from '@maiq/core/buttons'
  import FaceIcon from '$lib/components/face-icon.svelte'

  type Props = { worst: IssueStatus; total: number; label: string }

  let { worst, total, label }: Props = $props()
</script>

<issue-pill role="img" aria-label={label} title={label} data-worst={worst}>
  <FaceIcon status={worst} /><span>{total}</span>
</issue-pill>

<style>
  issue-pill {
    --face-size: 1.7cap;

    display: inline-block;
    flex: none;
    padding: 0 0.5rem 0 0.3rem;
    font-size: 0.78rem;
    font-weight: var(--weight-heavy);
    line-height: 1.4rem;
    white-space: nowrap;
    border-radius: var(--radius-pill);

    &[data-worst='unreliable'] {
      color: var(--issue-unreliable-ink);
      background: var(--issue-unreliable-bg);
    }

    &[data-worst='pending'] {
      color: var(--issue-pending-ink);
      background: var(--issue-pending-bg);
    }

    &[data-worst='broken'] {
      color: var(--issue-broken-ink);
      background: var(--issue-broken-bg);
    }
  }

  span {
    margin-inline-start: 0.2rem;
  }

  @media (max-width: 370px) {
    issue-pill {
      padding-inline: 0.25rem 0.4rem;
      font-size: 0.72rem;
    }

    span {
      margin-inline-start: 0.12rem;
    }
  }
</style>
