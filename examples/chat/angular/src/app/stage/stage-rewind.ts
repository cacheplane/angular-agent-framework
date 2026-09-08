/** Keep the previous browser frame visible while a backwards seek rebuilds the agent. */
export async function presentStageSeek(
  target: number,
  controller: { t(): number; seek(t: number): Promise<void> },
  settle: () => Promise<void>,
  doc: Pick<Document, 'startViewTransition'> = document,
): Promise<void> {
  const update = async () => {
    await controller.seek(target);
    await settle();
  };
  if (target < controller.t() && typeof doc.startViewTransition === 'function') {
    const transition = doc.startViewTransition(update);
    // A hidden tab may skip the visual transition; the update still runs.
    void transition.ready.catch(() => undefined);
    await transition.updateCallbackDone;
    await transition.finished.catch(() => undefined);
  } else {
    await update();
  }
}
