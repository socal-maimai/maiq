<script lang="ts">
  import { normalizeProps, useMachine } from '@zag-js/svelte'
  import * as toast from '@zag-js/toast'

  type Props = {
    actor: toast.Options
    parent: toast.GroupService
    index: number
  }

  let { actor, parent, index }: Props = $props()

  type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> }

  function defined<T extends object>(value: T): Defined<T> {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined)
    return Object.fromEntries(entries) as Defined<T>
  }

  const service = useMachine(toast.machine, () => ({ ...defined(actor), parent, index }))
  const api = $derived(toast.connect(service, normalizeProps))
</script>

<div {...api.getRootProps()}>
  <span {...api.getGhostBeforeProps()}></span>
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="9" fill="currentColor" />
    {#if api.type === 'error'}
      <path d="M10 5.5v5.5" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="10" cy="14.4" r="1.25" data-part="dot" />
    {:else}
      <path
        d="M6 10.4l2.6 2.6L14.2 7.4"
        fill="none"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    {/if}
  </svg>
  <p {...api.getTitleProps()}>{api.title}</p>
  <button {...api.getCloseTriggerProps()} aria-label="Dismiss"></button>
  <span {...api.getGhostAfterProps()}></span>
</div>

<style>
  [data-part='root'] {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    inline-size: min(22rem, calc(100vw - 2.5rem));
    padding: 0.8rem 1rem;
    font-size: 0.95rem;
    font-weight: var(--weight-heavy);
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 1rem;
    box-shadow: var(--shadow-raised);
    translate: 0 calc(var(--lift) * var(--offset));
    z-index: var(--z-index);

    & svg {
      flex: none;
      inline-size: 1.25rem;
      block-size: 1.25rem;
      color: var(--pink);
    }

    & path {
      stroke: var(--on-pink);
    }

    & [data-part='dot'] {
      fill: var(--on-pink);
    }

    &[data-type='error'] svg {
      color: var(--err);
    }
  }

  [data-part='title'] {
    flex: 1;
  }

  [data-part='close-trigger'] {
    position: absolute;
    inset: 0;
    padding: 0;
    background: none;
    border: 0;
    border-radius: inherit;
  }

  @media (prefers-reduced-motion: no-preference) {
    [data-part='root'] {
      transition: translate 200ms var(--ease-out);

      &[data-state='open'] {
        animation: m-toast-in 220ms var(--ease-out);
      }

      &[data-state='closed'] {
        animation: m-toast-out 180ms var(--ease-in) forwards;
      }
    }
  }

  @media (prefers-reduced-motion: reduce) {
    [data-part='root'][data-state='closed'] {
      opacity: 0;
    }
  }
</style>
