/** Wheel ownership is explicit; a pause only unlocks clicks, not local scrolling. */
export function stageWheelOwnership(
  host: Window,
  exploring: () => boolean,
  forward: (deltaX: number, deltaY: number) => boolean,
  resume: () => void,
): () => void {
  const wheel = (event: WheelEvent) => {
    if (exploring() || event.ctrlKey || !event.cancelable) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.innerHeight : 1;
    if (forward(event.deltaX * unit, event.deltaY * unit)) event.preventDefault();
  };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && exploring()) {
      resume();
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  host.addEventListener('wheel', wheel, { capture: true, passive: false });
  host.addEventListener('keydown', key, true);
  return () => {
    host.removeEventListener('wheel', wheel, true);
    host.removeEventListener('keydown', key, true);
  };
}
