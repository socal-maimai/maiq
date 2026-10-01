<script lang="ts">
  import { LINES, lineName } from '@maiq/core/arcades'
  import { maxPlayers } from '@maiq/core/caps'

  type Props = { busy: boolean; onSend: (report: TestReport) => void }
  type TestReport = { lineId: string; players: number; queue: number }

  let { busy, onSend }: Props = $props()

  let lineId = $state(LINES[0]?.id ?? '')
  let players = $state(0)
  let queue = $state(0)

  const line = $derived(LINES.find(candidate => candidate.id === lineId))
  const seats = $derived(line ? maxPlayers(line) : 0)

  function submit(event: SubmitEvent) {
    event.preventDefault()
    onSend({ lineId, players: Math.min(players, seats), queue })
  }
</script>

<form onsubmit={submit}>
  <label>
    <span>Line</span>
    <select bind:value={lineId}>
      {#each LINES as line (line.id)}
        <option value={line.id}>{lineName(line)}</option>
      {/each}
    </select>
  </label>
  <label>
    <span>Playing</span>
    <input type="number" min="0" max={seats} required bind:value={players} />
  </label>
  <label>
    <span>Waiting</span>
    <input type="number" min="0" max="40" required bind:value={queue} />
  </label>
  <button type="submit" data-variant="primary" disabled={busy} aria-busy={busy}>
    Send test report
  </button>
</form>

<style>
  form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    padding: 1rem;
    background: var(--card);
    border-radius: 1rem;
  }

  label {
    display: grid;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--muted);

    &:first-child {
      grid-column: 1 / -1;
    }
  }

  select,
  input {
    min-block-size: 2.5rem;
    padding: 0.4rem 0.7rem;
    font: inherit;
    font-size: 1rem;
    color: var(--ink);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 0.6rem;
  }

  button {
    grid-column: 1 / -1;
    padding: 0.75rem 1.25rem;
  }
</style>
