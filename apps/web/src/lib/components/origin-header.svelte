<script lang="ts">
  import HomePicker from '$lib/components/home-picker.svelte'
  import PinIcon from '$lib/components/pin-icon.svelte'
  import { viewer } from '$lib/viewer.svelte'

  let picking = $state(false)
  let askedOnce = false

  const origin = $derived(viewer.origin)

  $effect(() => {
    if (viewer.status === 'unavailable' && viewer.homeArcadeId === null && !askedOnce) {
      askedOnce = true
      picking = true
    }
  })
</script>

{#snippet pin()}
  <PinIcon shine />
{/snippet}

<header>
  <h1>maimai queues</h1>
  {#if origin.kind === 'position'}
    <p>{@render pin()}<span>You are near <strong>{origin.near.city}</strong></span></p>
  {:else if origin.kind === 'home'}
    <button type="button" data-touch onclick={() => (picking = true)}>
      {@render pin()}<span>Sorting from <strong>{origin.arcade.name}</strong></span>
    </button>
  {:else if viewer.status === 'unavailable'}
    <button type="button" data-touch onclick={() => (picking = true)}>
      {@render pin()}<span>Where do you usually play?</span>
    </button>
  {:else}
    <p>{@render pin()}<span>Finding arcades near you…</span></p>
  {/if}
</header>

<HomePicker bind:open={picking} />

<style>
  h1 {
    font-size: 2rem;
    letter-spacing: -0.01em;
  }

  p,
  button {
    display: block;
    margin-block: 0.35rem 1.5rem;
    color: var(--muted);
  }

  strong {
    color: var(--ink);
  }

  header :global(svg) {
    display: inline-block;
    inline-size: 1.6cap;
    block-size: 1.6cap;
    margin-inline-end: 0.35rem;
    color: var(--pink);
    vertical-align: calc((1cap - 1.6cap) / 2);
  }

  @media (prefers-reduced-motion: no-preference) {
    header :global(svg) {
      animation: m-rise 380ms var(--ease-out) 80ms both;
    }
  }

  button {
    padding: 0;
    text-align: start;
    background: none;
    border: 0;
    border-radius: 0.5rem;
  }
</style>
