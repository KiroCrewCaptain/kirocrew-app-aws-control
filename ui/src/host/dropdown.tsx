/**
 * The small dropdown menu the page's row and crumb menus use.
 *
 * The dashboard's `components/ui/dropdown-menu.tsx` wraps Radix and its guide and
 * overlay plumbing, none of which is on the App SDK, so this restates the part the
 * page relies on with the same names and props:
 *
 * - the trigger (`asChild`) opens on a primary pointer press or Enter / Space /
 *   ArrowDown, toggles on a keyboard click, and carries `aria-haspopup`,
 *   `aria-expanded` and `data-state`;
 * - the content is a `role="menu"` list aligned to the trigger's start or end edge;
 *   it closes on Escape, on a press outside it, or after an item is chosen;
 * - an item is a `role="menuitem"` button whose `onSelect(event)` runs on click;
 *   calling `event.preventDefault()` keeps the menu open, as in Radix;
 * - on close focus goes back to the trigger, unless `onCloseAutoFocus` prevents it
 *   (the page does that when the item opened a dialog that takes focus itself).
 *
 * It does not render into a portal or flip near the viewport edge (PORTING.md,
 * "Menus").
 */
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

interface MenuState {
  open: boolean
  setOpen: (open: boolean) => void
  triggerRef: { current: HTMLElement | null }
  contentId: string
  closeAutoFocus: { current: ((event: Event) => void) | undefined }
}

const MenuContext = createContext<MenuState | null>(null)

function useMenu(): MenuState {
  const state = useContext(MenuContext)
  if (!state) throw new Error('DropdownMenu parts must be inside <DropdownMenu>')
  return state
}

export function DropdownMenu({
  children,
  open: openProp,
  onOpenChange,
}: {
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = openProp ?? ownOpen
  const triggerRef = useRef<HTMLElement | null>(null)
  const closeAutoFocus = useRef<((event: Event) => void) | undefined>(undefined)
  const contentId = useId()
  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOwnOpen(next)
      onOpenChange?.(next)
      if (!next) {
        const event = new Event('dropdown.closeAutoFocus', { cancelable: true })
        closeAutoFocus.current?.(event)
        if (!event.defaultPrevented) {
          const trigger = triggerRef.current
          setTimeout(() => trigger?.focus({ preventScroll: true }), 0)
        }
      }
    },
    [openProp, onOpenChange],
  )
  const value = useMemo(
    () => ({ open, setOpen, triggerRef, contentId, closeAutoFocus }),
    [open, setOpen, contentId],
  )
  return (
    <MenuContext.Provider value={value}>
      <span className="relative inline-flex">{children}</span>
    </MenuContext.Provider>
  )
}

type TriggerChildProps = HTMLAttributes<HTMLElement> & { ref?: unknown }

export function DropdownMenuTrigger({ children, asChild }: { children: ReactNode; asChild?: boolean }) {
  const menu = useMenu()
  const pointerOpened = useRef(false)
  const child = Children.only(children)
  const element: ReactElement<TriggerChildProps> = asChild && isValidElement(child)
    ? (child as ReactElement<TriggerChildProps>)
    : <button type="button">{children}</button>
  const own = element.props
  return cloneElement(element, {
    ref: (node: HTMLElement | null) => {
      menu.triggerRef.current = node
    },
    'aria-haspopup': 'menu',
    'aria-expanded': menu.open,
    'aria-controls': menu.open ? menu.contentId : undefined,
    'data-state': menu.open ? 'open' : 'closed',
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      own.onPointerDown?.(event)
      if (event.defaultPrevented || (event.button ?? 0) !== 0 || event.ctrlKey) return
      pointerOpened.current = true
      menu.setOpen(!menu.open)
      event.preventDefault()
    },
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      own.onClick?.(event)
      if (pointerOpened.current) {
        pointerOpened.current = false
        return
      }
      if (!event.defaultPrevented) menu.setOpen(!menu.open)
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      own.onKeyDown?.(event)
      if (event.defaultPrevented) return
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault()
        menu.setOpen(true)
      }
    },
  } as Partial<TriggerChildProps>)
}

export function DropdownMenuContent({
  children,
  align = 'center',
  className = '',
  onCloseAutoFocus,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  onCloseAutoFocus?: (event: Event) => void
}) {
  const menu = useMenu()
  const ref = useRef<HTMLDivElement>(null)
  menu.closeAutoFocus.current = onCloseAutoFocus
  const { open, setOpen, triggerRef } = menu

  useEffect(() => {
    if (!open) return
    const first = ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')
    first?.focus({ preventScroll: true })
    const onPointer = (event: PointerEvent | MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (ref.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open, setOpen, triggerRef])

  if (!open) return null
  const side = align === 'end' ? 'right-0' : align === 'start' ? 'left-0' : 'left-1/2 -translate-x-1/2'
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    rest.onKeyDown?.(event)
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    )
    if (!items.length) return
    event.preventDefault()
    const at = items.indexOf(document.activeElement as HTMLElement)
    const step = event.key === 'ArrowDown' ? 1 : -1
    items[(at + step + items.length) % items.length].focus()
  }
  return (
    <div
      {...rest}
      ref={ref}
      id={menu.contentId}
      role="menu"
      onKeyDown={onKeyDown}
      className={`absolute top-full mt-1 ${side} z-50 min-w-[10rem] rounded-lg border border-border bg-card p-1 shadow-lg ${className}`}
    >
      {children}
    </div>
  )
}

export function DropdownMenuItem({
  children,
  onSelect,
  disabled,
  className = '',
  ...rest
}: Omit<HTMLAttributes<HTMLButtonElement>, 'onSelect'> & {
  onSelect?: (event: Event) => void
  disabled?: boolean
  'data-testid'?: string
}) {
  const menu = useMenu()
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? '' : undefined}
      {...rest}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-text bg-transparent border-none cursor-pointer hover:bg-bg-hover focus:bg-bg-hover focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      onClick={(event) => {
        rest.onClick?.(event)
        if (disabled) return
        const selectEvent = new Event('dropdown.select', { cancelable: true })
        onSelect?.(selectEvent)
        if (!selectEvent.defaultPrevented) menu.setOpen(false)
      }}
    >
      {children}
    </button>
  )
}

export function DropdownMenuSeparator({ className = '' }: { className?: string }) {
  return <div role="separator" className={`my-1 h-px bg-border ${className}`} />
}
