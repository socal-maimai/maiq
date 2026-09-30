<script lang="ts">
  import * as combobox from '@zag-js/combobox'
  import { normalizeProps, useMachine } from '@zag-js/svelte'

  type Item = { value: string; label: string }

  type Props = {
    items: Item[]
    label: string
    value?: string | null
    placeholder?: string
  }

  let { items, label, value = $bindable(null), placeholder = '' }: Props = $props()

  let filtered = $derived(items)

  const collection = $derived(
    combobox.collection({
      items: filtered,
      itemToValue: item => item.value,
      itemToString: item => item.label,
    })
  )

  const id = $props.id()
  const service = useMachine(combobox.machine, () => ({
    id,
    collection,
    value: value === null ? [] : [value],
    placeholder,
    openOnClick: true,
    positioning: {
      strategy: 'fixed' as const,
      sameWidth: true,
      gutter: 6,
      placement: 'bottom-start' as const,
    },
    onValueChange(details: combobox.ValueChangeDetails<Item>) {
      value = details.value[0] ?? null
    },
    onOpenChange() {
      filtered = items
    },
    onInputValueChange(details: combobox.InputValueChangeDetails) {
      const query = details.inputValue.trim().toLowerCase()
      filtered = items.filter(item => item.label.toLowerCase().includes(query))
    },
  }))
  const api = $derived(combobox.connect(service, normalizeProps))
</script>

<div {...api.getRootProps()}>
  <label {...api.getLabelProps()}>{label}</label>
  <div {...api.getControlProps()}>
    <input {...api.getInputProps()} />
    <button {...api.getTriggerProps()} aria-label="Show all">
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3.5 6L8 10.5L12.5 6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>
</div>
<div {...api.getPositionerProps()}>
  <ul {...api.getContentProps()}>
    {#each filtered as item (item.value)}
      <li {...api.getItemProps({ item })}>{item.label}</li>
    {:else}
      <li data-empty role="presentation">No arcades match</li>
    {/each}
  </ul>
</div>

<style>
  [data-part='root'] {
    display: grid;
    min-inline-size: 0;
    gap: 0.35rem;
  }

  [data-part='label'] {
    font-size: 0.85rem;
    color: var(--muted);
  }

  [data-part='control'] {
    display: flex;
    min-inline-size: 0;
    align-items: center;
    background: var(--bg);
    border-radius: 0.9rem;

    &:focus-within {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }
  }

  input {
    flex: 1;
    min-inline-size: 0;
    padding: 0.8rem 1rem;
    font-size: 1.1rem;
    font-weight: var(--weight-heavy);
    color: var(--ink);
    background: transparent;
    border: 0;
    outline: none;

    &::placeholder {
      font-weight: var(--weight-regular);
      color: var(--muted);
    }
  }

  [data-part='trigger'] {
    align-self: stretch;
    padding-inline: 1rem;
    color: var(--muted);
    background: none;
    border: 0;
    border-radius: 0 0.9rem 0.9rem 0;

    &:focus-visible {
      outline-offset: -3px;
    }

    & svg {
      inline-size: 1rem;
      block-size: 1rem;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    [data-part='trigger'] svg {
      transition: transform 160ms var(--ease-out);
    }
  }

  [data-part='trigger'][data-state='open'] svg {
    transform: rotate(180deg);
  }

  [data-part='positioner'] {
    z-index: var(--layer-popover) !important;
  }

  [data-part='content'] {
    max-block-size: 16rem;
    padding: 0.35rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 1rem;
    box-shadow: var(--shadow-raised);

    &[hidden] {
      display: none;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    [data-part='content'][data-state='open'] {
      animation: m-pop-in 160ms var(--ease-out);
    }
  }

  li {
    padding: 0.55rem 0.8rem;
    border-radius: 0.7rem;
    cursor: pointer;

    &[data-highlighted] {
      background: var(--bg);
    }

    &[data-state='checked'] {
      font-weight: var(--weight-heavy);
      color: var(--pink);
    }

    &[data-empty] {
      color: var(--muted);
      cursor: default;
    }
  }
</style>
