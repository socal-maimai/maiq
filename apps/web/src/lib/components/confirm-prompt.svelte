<script lang="ts">
  import { lineName, type Line } from '@maiq/core/arcades'
  import { formatCount, type Count } from '@maiq/core/count'
  import { retryText } from '@maiq/core/retry'
  import { PostConfirm } from '@maiq/types'
  import { useQueryClient } from '@tanstack/svelte-query'
  import { apiRequest } from '$lib/api'
  import { hintForError } from '$lib/api-error'
  import { storeLine } from '$lib/query'
  import { toast } from '$lib/toast'
  import { writerFields } from '$lib/writes'

  type Props = { line: Line; count: Count; onUpdate: () => void }

  let { line, count, onUpdate }: Props = $props()

  const queryClient = useQueryClient()
  let sending = $state(false)

  const shown = $derived(formatCount(count))

  async function confirm(): Promise<void> {
    if (sending) return
    sending = true
    try {
      const response = await apiRequest(PostConfirm, {
        lineId: line.id,
        ...(await writerFields(queryClient)),
      })
      switch (response.kind) {
        case 'goodConfirm':
          storeLine(queryClient, response.data.line)
          toast.thanks()
          return
        case 'badRateLimit':
          toast.error(`You just confirmed this line. ${retryText(response.data.retryAfterMs)}`)
          return
        case 'badValidation':
          toast.error(`${response.message} (${response.data.reason})`)
          return
        case 'badCaptcha':
        case 'badNothingToConfirm':
        case 'badUnknownLine':
          toast.error(response.message)
          return
      }
    } catch (error) {
      toast.error(hintForError(error))
    } finally {
      sending = false
    }
  }
</script>

<section>
  <p>At <strong>{lineName(line)}</strong>? Is it still <strong>{shown}</strong>?</p>
  <prompt-actions>
    <button
      type="button"
      data-variant="primary"
      data-touch
      disabled={sending}
      aria-busy={sending}
      onclick={() => void confirm()}
    >
      <span>Yes, still {shown}</span>
      {#if sending}<busy-ring aria-hidden="true"></busy-ring>{/if}
    </button>
    <button type="button" data-variant="ghost" data-touch onclick={onUpdate}>No, update it</button>
  </prompt-actions>
</section>

<style>
  section {
    display: grid;
    gap: 0.8rem;
    padding: 1rem 1.1rem;
    background: var(--card);
    border: 2px solid color-mix(in srgb, var(--pink) 35%, transparent);
    border-radius: 1.25rem;
    box-shadow: var(--shadow-raised);
  }

  p {
    font-size: 1.05rem;
  }

  prompt-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  button {
    padding: 0.65rem 1.1rem;
    font-size: 0.95rem;
    border: 0;
    border-radius: var(--radius-pill);
  }

  [data-variant='ghost'] {
    color: var(--muted);
    background: transparent;
  }

  @media (prefers-reduced-motion: no-preference) {
    section {
      animation: m-float-in 280ms var(--ease-out);
    }
  }
</style>
