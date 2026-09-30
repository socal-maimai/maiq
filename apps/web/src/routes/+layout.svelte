<script lang="ts">
  // oxlint-disable-next-line import/no-unassigned-import -- global stylesheet
  import '$lib/styles/reset.css'
  // oxlint-disable-next-line import/no-unassigned-import -- global stylesheet
  import '$lib/styles/tokens.css'
  // oxlint-disable-next-line import/no-unassigned-import -- global stylesheet
  import '$lib/styles/motion.css'
  import { QueryClientProvider } from '@tanstack/svelte-query'
  import type { Snippet } from 'svelte'
  import { createQueryClient } from '$lib/query'
  import ToastHost from '$lib/ui/toast-host.svelte'

  type Props = { children: Snippet }

  let { children }: Props = $props()

  const queryClient = createQueryClient()
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
<ToastHost />
