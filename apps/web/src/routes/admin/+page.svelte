<script lang="ts">
  import { findLine, lineName } from '@maiq/core/arcades'
  import { cabinetLabel, isStation } from '@maiq/core/buttons'
  import type { AdminButtonReportJson, AdminQueueReportJson, ReportTable } from '@maiq/types'
  import { createQuery, useQueryClient } from '@tanstack/svelte-query'
  import {
    adminActions,
    adminReportsQuery,
    adminSessionQuery,
    SIGN_IN_ERRORS,
    signOut,
  } from '$lib/admin'
  import { hintForError } from '$lib/api-error'
  import AdminReportRow, { type AdminRow } from '$lib/components/admin-report-row.svelte'
  import AdminTestForm from '$lib/components/admin-test-form.svelte'
  import { toast, toaster } from '$lib/toast'

  const queryClient = useQueryClient()
  const actions = adminActions(queryClient)
  const session = createQuery(() => adminSessionQuery)
  const reports = createQuery(() => ({ ...adminReportsQuery, enabled: Boolean(session.data) }))

  const signInError = SIGN_IN_ERRORS[new URLSearchParams(location.search).get('error') ?? '']

  let tab = $state<ReportTable>('queue')
  let busy = $state(false)

  const muted = $derived(new Set(reports.data?.mutes.map(mute => mute.reporter)))

  const nameOf = (lineId: string): string => {
    const line = findLine(lineId)
    return line ? lineName(line) : lineId
  }

  const base = (row: AdminQueueReportJson | AdminButtonReportJson) => ({
    at: row.createdAt,
    line: nameOf(row.lineId),
    reporter: row.reporter,
    hidden: row.hiddenAt !== null,
    test: row.test,
    muted: muted.has(row.reporter),
  })

  const queueRow = (row: AdminQueueReportJson): AdminRow => ({
    ...base(row),
    key: `queue-${row.id}`,
    reporterName: row.reporterName,
    summary: `${row.kind === 'confirm' ? 'Confirmed' : 'Reported'} ${row.players} playing, ${row.queue} waiting`,
    detail: '',
    verified: row.inGeofence === true,
  })

  function buttonRow(row: AdminButtonReportJson): AdminRow {
    const line = findLine(row.lineId)
    const cab = line ? cabinetLabel(line, row.cab) : `Cab ${row.cab}`
    const target = isStation(row) ? 'whole side' : `button ${row.button}`
    return {
      ...base(row),
      key: `button-${row.id}`,
      summary: `${cab}, ${row.side}P ${target}: ${row.kind}`,
      detail: row.description,
      reporterName: null,
      verified: false,
    }
  }

  const rows = $derived(
    tab === 'queue'
      ? (reports.data?.queue.map(row => ({ id: row.id, view: queueRow(row) })) ?? [])
      : (reports.data?.buttons.map(row => ({ id: row.id, view: buttonRow(row) })) ?? [])
  )

  async function run(action: () => Promise<void>, done?: string) {
    busy = true
    try {
      await action()
      if (done) toaster.success({ title: done })
    } catch (error) {
      toast.error(hintForError(error))
    } finally {
      busy = false
    }
  }
</script>

<svelte:head>
  <title>maiq admin</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<admin-shell>
  <header>
    <h1>maiq admin</h1>
    {#if session.data}
      <p>
        <span>Signed in as <strong>{session.data.name}</strong></span>
        <button type="button" onclick={() => run(() => signOut(queryClient))}>Sign out</button>
      </p>
    {/if}
  </header>

  {#if session.isPending}
    <admin-note role="status">Checking sign-in…</admin-note>
  {:else if !session.data}
    <sign-in>
      {#if signInError}<p role="alert">{signInError}</p>{/if}
      <p>Only people on the admin list can open this page.</p>
      <a href="/auth/discord" data-variant="primary">Sign in with Discord</a>
    </sign-in>
  {:else}
    <section aria-labelledby="test-heading">
      <h2 id="test-heading">Test report</h2>
      <p>Shows on the live board like a normal report, but is marked as a test.</p>
      <AdminTestForm
        {busy}
        onSend={report => run(() => actions.sendTest(report), 'Test report sent.')}
      />
    </section>

    {#if reports.data?.mutes.length}
      <section aria-labelledby="muted-heading">
        <h2 id="muted-heading">Muted</h2>
        <ul data-list>
          {#each reports.data.mutes as mute (mute.reporter)}
            <li data-mute>
              <span title={mute.reporter}>{mute.reporter}</span>
              <button
                type="button"
                disabled={busy}
                onclick={() => run(() => actions.setMuted({ reporter: mute.reporter, muted: false }))}
              >
                Unmute
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section aria-labelledby="reports-heading">
      <h2 id="reports-heading">Recent reports</h2>
      <tab-bar role="group" aria-label="Report type">
        <button type="button" aria-pressed={tab === 'queue'} onclick={() => (tab = 'queue')}>
          Queues
        </button>
        <button type="button" aria-pressed={tab === 'button'} onclick={() => (tab = 'button')}>
          Buttons
        </button>
      </tab-bar>
      {#if reports.isError}
        <admin-note role="alert">Could not load reports. {hintForError(reports.error)}</admin-note>
      {:else if !reports.data}
        <admin-note role="status">Loading reports…</admin-note>
      {:else if rows.length === 0}
        <admin-note role="status">No reports yet.</admin-note>
      {:else}
        <ul data-list>
          {#each rows as { id, view } (view.key)}
            <AdminReportRow
              row={view}
              {busy}
              onHide={hidden => run(() => actions.setHidden({ table: tab, id, hidden }))}
              onMute={isMuted =>
                run(() => actions.setMuted({ reporter: view.reporter, muted: isMuted }))}
            />
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</admin-shell>

<style>
  admin-shell {
    display: grid;
    gap: 1.75rem;
    max-inline-size: 40rem;
    margin-inline: auto;
    padding: 2rem 1.25rem 4rem;
  }

  header {
    display: grid;
    gap: 0.5rem;

    & h1 {
      margin: 0;
      font-size: 1.6rem;
    }

    & p {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 0.75rem;
      align-items: center;
      margin: 0;
      color: var(--muted);
    }
  }

  section {
    display: grid;
    gap: 0.75rem;

    & h2 {
      margin: 0;
      font-size: 1.15rem;
    }

    & > p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--muted);
    }
  }

  sign-in {
    display: grid;
    gap: 1rem;
    justify-items: start;
    padding: 1.25rem;
    background: var(--card);
    border-radius: 1rem;

    & p {
      margin: 0;
    }

    & [role='alert'] {
      color: var(--err);
    }

    & a {
      padding: 0.75rem 1.4rem;
      text-decoration: none;
    }
  }

  admin-note {
    display: block;
    padding: 0.9rem 1.1rem;
    color: var(--muted);
    background: var(--card);
    border-radius: 1rem;
  }

  [data-list] {
    display: grid;
    gap: 0.6rem;
    margin: 0;
  }

  [data-mute] {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1rem;
    background: var(--card);
    border-radius: 1rem;

    & span {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
  }

  tab-bar {
    display: flex;
    gap: 0.4rem;
  }

  header button,
  [data-mute] button,
  tab-bar button {
    min-block-size: 2.25rem;
    padding: 0.3rem 0.95rem;
    font-weight: var(--weight-heavy);
    background: var(--card);
    border: 0;
    border-radius: var(--radius-pill);

    &:disabled {
      opacity: 0.45;
      cursor: default;
    }
  }

  tab-bar button[aria-pressed='true'] {
    color: var(--on-pink);
    background: var(--pink);
  }
</style>
