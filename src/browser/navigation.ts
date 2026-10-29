/** Move within the current document without changing URLs or navigating a srcdoc iframe. */
export function focusArrivals(): void {
  const target = document.getElementById('arrival-area');
  target?.scrollIntoView({ block: 'start', behavior: 'auto' });
  target?.focus({ preventScroll: true });
}
