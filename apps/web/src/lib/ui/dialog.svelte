<script lang="ts">
  import * as dialog from '@zag-js/dialog'
  import { normalizeProps, useMachine } from '@zag-js/svelte'
  import { tick, type Snippet } from 'svelte'
  import type { Attachment } from 'svelte/attachments'

  type Props = {
    open?: boolean
    title: string
    description?: string
    presentation?: 'center' | 'drawer' | 'card'
    initialFocus?: () => HTMLElement | null
    onExitComplete?: () => void
    leading?: Snippet
    subtitle?: Snippet
    toolbar?: Snippet
    children: Snippet
  }

  let {
    open = $bindable(false),
    title,
    description,
    presentation = 'center',
    initialFocus,
    onExitComplete,
    leading,
    subtitle,
    toolbar,
    children,
  }: Props = $props()

  const id = $props.id()
  const service = useMachine(dialog.machine, () => ({
    id,
    open,
    ...(initialFocus ? { initialFocusEl: initialFocus } : {}),
    onOpenChange(details: dialog.OpenChangeDetails) {
      open = details.open
    },
  }))
  const api = $derived(dialog.connect(service, normalizeProps))

  let mounted = $state(false)
  let scrolled = $state(false)
  let backdrop = $state<HTMLElement | null>(null)
  let content = $state<HTMLElement | null>(null)

  $effect.pre(() => {
    if (api.open) mounted = true
  })

  $effect(() => {
    if (api.open || !mounted) return
    let cancelled = false
    void tick().then(async () => {
      const animations = [backdrop, content].flatMap(node => node?.getAnimations() ?? [])
      await Promise.allSettled(animations.map(animation => animation.finished))
      if (cancelled) return
      mounted = false
      scrolled = false
      onExitComplete?.()
    })
    return () => {
      cancelled = true
    }
  })

  const portal: Attachment<HTMLElement> = node => {
    document.body.appendChild(node)
    return () => node.remove()
  }

  const fitVisualViewport: Attachment<HTMLElement> = node => {
    const viewport = window.visualViewport
    if (!viewport) return
    const place = () => {
      node.style.setProperty('--visible-top', `${viewport.offsetTop}px`)
      node.style.setProperty('--visible-height', `${viewport.height}px`)
    }
    const resize = () => {
      place()
      const focused = document.activeElement
      if (focused instanceof HTMLElement && content?.contains(focused)) {
        focused.scrollIntoView({ block: 'center' })
      }
    }
    place()
    viewport.addEventListener('resize', resize)
    viewport.addEventListener('scroll', place)
    return () => {
      viewport.removeEventListener('resize', resize)
      viewport.removeEventListener('scroll', place)
    }
  }

  const trackScroll: Attachment<HTMLElement> = node => {
    const update = () => {
      scrolled = node.scrollTop > 2
    }
    node.addEventListener('scroll', update, { passive: true })
    return () => node.removeEventListener('scroll', update)
  }
</script>

{#if mounted}
  <dialog-root {@attach portal} {@attach fitVisualViewport}>
    <div
      bind:this={backdrop}
      {...api.getBackdropProps()}
      hidden={false}
      data-presentation={presentation}
    ></div>
    <div {...api.getPositionerProps()} data-presentation={presentation}>
      <div bind:this={content} {...api.getContentProps()} hidden={false}>
        <dialog-header>
          {#if leading}
            {@render leading()}
          {/if}
          <dialog-heading>
            <h2 {...api.getTitleProps()}>{title}</h2>
            {#if description}
              <p {...api.getDescriptionProps()}>{description}</p>
            {/if}
            {#if subtitle}
              {@render subtitle()}
            {/if}
          </dialog-heading>
          <button {...api.getCloseTriggerProps()} data-touch>Close</button>
        </dialog-header>
        {#if toolbar}
          <dialog-toolbar>
            {@render toolbar()}
          </dialog-toolbar>
        {/if}
        <dialog-body data-scrolled={scrolled ? '' : undefined} {@attach trackScroll}>
          {@render children()}
        </dialog-body>
      </div>
    </div>
  </dialog-root>
{/if}

<style>
  dialog-root {
    display: contents;
  }

  [data-part='backdrop'] {
    position: fixed;
    inset: 0;
    z-index: calc(var(--layer-dialog) + var(--layer-index, 0) * 2 - 1);
    background: var(--scrim);

    &[data-presentation='card'] {
      background: var(--scrim-soft);
    }
  }

  [data-part='positioner'] {
    position: fixed;
    inset-block-start: var(--visible-top, 0px);
    inset-inline: 0;
    block-size: var(--visible-height, 100%);
    z-index: calc(var(--layer-dialog) + var(--layer-index, 0) * 2);
    display: flex;
  }

  [data-part='content'] {
    display: flex;
    flex-direction: column;
    inline-size: 100%;
    max-inline-size: 34rem;
    overflow: hidden;
    background: var(--card);
  }

  dialog-header {
    display: flex;
    flex: none;
    align-items: flex-start;
    gap: 1rem;

    &:has(dialog-heading > h2:only-child) {
      align-items: center;
    }
  }

  dialog-heading {
    display: grid;
    flex: 1;
    min-inline-size: 0;
    gap: 0.15rem;
  }

  h2 {
    font-size: 1.3rem;
  }

  [data-part='description'] {
    color: var(--muted);
    font-size: 0.9rem;
  }

  dialog-toolbar {
    display: block;
    flex: none;
  }

  dialog-body {
    display: grid;
    flex: 1 1 auto;
    align-content: start;
    min-block-size: 0;
    overflow-y: auto;
    overscroll-behavior: contain;

    &[data-scrolled] {
      mask-image: linear-gradient(to bottom, transparent 0, #000 1.5rem);
    }
  }

  [data-part='close-trigger'] {
    flex: none;
    padding: 0.5rem 0.9rem;
    font-weight: var(--weight-heavy);
    color: var(--ink);
    background: var(--bg);
    border: 0;
    border-radius: var(--radius-pill);
  }

  [data-part='positioner'][data-presentation='center'] {
    align-items: center;
    justify-content: center;
    padding: 0.75rem;

    & [data-part='content'] {
      max-inline-size: 31.5rem;
      max-block-size: calc(100% - 3rem);
      border-radius: 1.4rem;
      box-shadow: var(--shadow-overlay);
    }

    & dialog-header {
      padding: 1.1rem 1.1rem 0;
    }

    & dialog-body {
      gap: 0.85rem;
      padding: 0.85rem 1.1rem 1.1rem;
    }
  }

  [data-part='positioner'][data-presentation='drawer'] {
    align-items: flex-end;
    justify-content: center;

    & [data-part='content'] {
      max-block-size: 88%;
      border-radius: 1.5rem 1.5rem 0 0;
      box-shadow: var(--shadow-sheet);
    }

    & dialog-header {
      padding: 1.25rem 1.25rem 0.4rem;
    }

    & dialog-toolbar {
      padding: 0.5rem 1.25rem 0.4rem;
    }

    & dialog-body {
      gap: 1.1rem;
      padding: 1rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 0px));
    }
  }

  [data-part='positioner'][data-presentation='card'] {
    align-items: flex-end;
    justify-content: center;
    padding: 0.75rem 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px));

    & [data-part='content'] {
      max-inline-size: 31.5rem;
      max-block-size: 100%;
      border-radius: 1.4rem;
      box-shadow: var(--shadow-overlay);
    }

    & dialog-header {
      gap: 0.75rem;
      padding: 1.1rem 1.1rem 0;
    }

    & h2 {
      font-size: 1.05rem;
    }

    & dialog-body {
      gap: 0.85rem;
      padding: 0.85rem 1.1rem 1.1rem;
    }

    & [data-part='close-trigger'] {
      padding: 0.45rem 0.8rem;
      font-size: 0.85rem;
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    [data-part='backdrop'] {
      &[data-state='open'] {
        animation: m-fade-in 240ms var(--ease-out);
      }

      &[data-state='closed'] {
        animation: m-fade-out 200ms var(--ease-in) forwards;
      }
    }

    [data-part='positioner'][data-presentation='center'] [data-part='content'] {
      &[data-state='open'] {
        animation: m-pop-in 200ms var(--ease-out);
      }

      &[data-state='closed'] {
        animation: m-pop-out 150ms var(--ease-in) forwards;
      }
    }

    [data-part='positioner'][data-presentation='drawer'] [data-part='content'] {
      will-change: transform;

      &[data-state='open'] {
        animation: m-sheet-in 340ms var(--ease-out);
      }

      &[data-state='closed'] {
        animation: m-sheet-out 220ms var(--ease-in) forwards;
      }
    }

    [data-part='positioner'][data-presentation='card'] [data-part='content'] {
      &[data-state='open'] {
        animation: m-float-in 280ms var(--ease-out);
      }

      &[data-state='closed'] {
        animation: m-float-out 180ms var(--ease-in) forwards;
      }
    }
  }
</style>
