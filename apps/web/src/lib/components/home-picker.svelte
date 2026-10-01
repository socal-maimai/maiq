<script lang="ts">
  import { ARCADES } from '@maiq/core/arcades'
  import Combobox from '$lib/ui/combobox.svelte'
  import Dialog from '$lib/ui/dialog.svelte'
  import { viewer } from '$lib/viewer.svelte'

  type Props = { open?: boolean }

  let { open = $bindable(false) }: Props = $props()

  const items = ARCADES.map(arcade => ({
    value: arcade.id,
    label: `${arcade.name}, ${arcade.city}`,
  }))

  function pick(arcadeId: string | null): void {
    if (!arcadeId || arcadeId === viewer.homeArcadeId) return
    viewer.setHome(arcadeId)
    open = false
  }
</script>

<Dialog
  bind:open
  title="Where do you usually play?"
  description="Arcades are sorted by distance from here. This stays on your device."
>
  <Combobox
    {items}
    label="Home arcade"
    bind:value={() => viewer.homeArcadeId, pick}
    placeholder="Pick an arcade"
  />
</Dialog>
