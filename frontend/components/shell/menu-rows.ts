// The sidebar's two menu rows. The menus themselves load after the page, and the shell draws a
// look-alike row meanwhile: sharing the classes keeps the stand-ins exactly the real rows' size.
export const notificationsRowClass =
  "flex w-full items-center justify-between py-1.5 text-[15px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"

export const accountRowClass =
  "w-full py-1.5 text-left text-[15px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none"
