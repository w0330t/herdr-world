/**
 * Extracts the Herdr event name from a subscription envelope. Herdr emits
 * `{ event, data }` where `data.type` mirrors the event name, so accept both.
 */
export function herdrEventName(event: unknown): string | null {
  if (!event || typeof event !== "object" || Array.isArray(event)) return null;
  const envelope = event as {
    event?: unknown;
    data?: unknown;
  };
  if (typeof envelope.event === "string" && envelope.event) {
    return envelope.event;
  }
  const data = envelope.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const type = (data as { type?: unknown }).type;
    if (typeof type === "string" && type) return type;
  }
  return null;
}

/** Pane fields Herdr refreshes as a terminal repaints (spinner titles, scroll). */
const PANE_ACTIVITY_FIELDS = new Set([
  "revision",
  "terminal_title",
  "terminal_title_stripped",
  "scroll",
]);

/**
 * Tells pane activity from changes World must re-observe. An update is activity
 * when it differs from the same pane's previous update only in repaint fields.
 * Memory spans an unbroken run of pane updates: any other event, and reset() at
 * each subscription ACK, forget it, so a missed event cannot hide a change.
 */
export function createPaneActivity() {
  const panes = new Map<string, string>();
  return {
    isActivity(event: unknown): boolean {
      const name = herdrEventName(event);
      const pane =
        name === "pane_updated" || name === "pane.updated"
          ? (event as { data?: { pane?: unknown } }).data?.pane
          : undefined;
      if (
        !pane ||
        typeof pane !== "object" ||
        Array.isArray(pane) ||
        typeof (pane as { pane_id?: unknown }).pane_id !== "string"
      ) {
        panes.clear();
        return false;
      }
      const record = pane as Record<string, unknown>;
      const signature = JSON.stringify(
        Object.keys(record)
          .filter((key) => !PANE_ACTIVITY_FIELDS.has(key))
          .sort()
          .map((key) => [key, record[key]]),
      );
      const id = record.pane_id as string;
      const previous = panes.get(id);
      panes.set(id, signature);
      return previous === signature;
    },
    reset() {
      panes.clear();
    },
  };
}
