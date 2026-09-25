/**
 * Run `task` once every task queued before it under the same key has settled — resolved or
 * thrown — so each task sees what the one before it left behind. The caller gets the task's
 * own outcome; the stored chain never rejects, so one failure does not block the tasks after
 * it. The key's entry is removed when the last queued task settles.
 */
export function runSerialized(chains: Map<string, Promise<void>>, key: string, task: () => Promise<void>): Promise<void> {
  const run = (chains.get(key) ?? Promise.resolve()).then(task);
  const settled = run.catch(() => {});
  chains.set(key, settled);
  void settled.then(() => {
    if (chains.get(key) === settled) chains.delete(key);
  });
  return run;
}
