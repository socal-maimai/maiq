<script lang="ts">
  import { normalizeProps, useMachine } from '@zag-js/svelte'
  import * as toast from '@zag-js/toast'
  import { toaster } from '$lib/toast'
  import ToastItem from '$lib/ui/toast-item.svelte'

  const id = $props.id()
  const service = useMachine(toast.group.machine, () => ({ id, store: toaster }))
  const api = $derived(toast.group.connect(service, normalizeProps))
</script>

<div {...api.getGroupProps()}>
  {#each api.getToasts() as item, index (item.id)}
    <ToastItem actor={item} parent={service} {index} />
  {/each}
</div>

<style>
  [data-part='group'] {
    z-index: var(--layer-toast);
  }
</style>
