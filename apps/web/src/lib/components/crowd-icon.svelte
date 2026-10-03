<script lang="ts">
  import type { WaitTier } from '@maiq/core/rotation'
  import UserIcon from 'phosphor-svelte/lib/UserIcon'
  import UsersIcon from 'phosphor-svelte/lib/UsersIcon'
  import UsersThreeIcon from 'phosphor-svelte/lib/UsersThreeIcon'

  type Props = { tier: WaitTier }

  let { tier }: Props = $props()

  const ICONS = { go: UserIcon, soon: UsersIcon, long: UsersThreeIcon }
  const Icon = $derived(ICONS[tier])
</script>

<crowd-icon aria-hidden="true">
  <Icon weight="fill" size="1.25em" color="currentColor" />
</crowd-icon>

<style>
  crowd-icon {
    display: inline-flex;
    margin-inline-end: 0.3rem;
    vertical-align: -0.2em;
  }
</style>
