import { describe, expect, test } from "bun:test";
import { createPaneActivity } from "./herdr-events";

const basePane = {
  pane_id: "pane-1",
  revision: 1,
  terminal_title: "⠋ working",
  terminal_title_stripped: "working",
  scroll: 0,
  agent_status: "working",
  focused: true,
  tab_id: "tab-1",
  cwd: "/tmp",
};

function update(pane: Record<string, unknown>, name = "pane_updated") {
  return { event: name, data: { pane } };
}

/** The same pane after a repaint: only the spinner title and scroll moved. */
function repaint(overrides: Record<string, unknown> = {}) {
  return {
    ...basePane,
    revision: 2,
    terminal_title: "⠙ working",
    terminal_title_stripped: "working",
    scroll: 1,
    ...overrides,
  };
}

describe("createPaneActivity", () => {
  test("classifies the first pane update as a change and repaint-only updates as activity", () => {
    const activity = createPaneActivity();
    expect(activity.isActivity(update(basePane))).toBe(false);
    expect(activity.isActivity(update(repaint()))).toBe(true);
    expect(
      activity.isActivity(
        update({
          ...basePane,
          revision: 3,
          terminal_title: "⠹ working",
          terminal_title_stripped: "working⠹",
          scroll: 5,
        }),
      ),
    ).toBe(true);
  });

  test("reads dotted and data.type-only envelopes the same way", () => {
    const dotted = createPaneActivity();
    expect(dotted.isActivity(update(basePane, "pane.updated"))).toBe(false);
    expect(dotted.isActivity(update(repaint(), "pane.updated"))).toBe(true);

    const typed = createPaneActivity();
    const typedUpdate = (pane: Record<string, unknown>) => ({
      data: { type: "pane_updated", pane },
    });
    expect(typed.isActivity(typedUpdate(basePane))).toBe(false);
    expect(typed.isActivity(typedUpdate(repaint()))).toBe(true);
  });

  test.each(["agent_status", "focused", "tab_id", "cwd"])(
    "treats a change to %s as a change World must observe",
    (field) => {
      const activity = createPaneActivity();
      expect(activity.isActivity(update(basePane))).toBe(false);
      expect(
        activity.isActivity(
          update(repaint({ [field]: field === "focused" ? false : "changed" })),
        ),
      ).toBe(false);
    },
  );

  test("forgets pane memory after any other event", () => {
    const activity = createPaneActivity();
    expect(activity.isActivity(update(basePane))).toBe(false);
    expect(
      activity.isActivity({ event: "pane_focused", data: { pane: repaint() } }),
    ).toBe(false);
    expect(activity.isActivity(update(repaint({ revision: 3 })))).toBe(false);
    expect(activity.isActivity(update(repaint({ revision: 4 })))).toBe(true);
  });

  test("forgets pane memory on reset", () => {
    const activity = createPaneActivity();
    expect(activity.isActivity(update(basePane))).toBe(false);
    expect(activity.isActivity(update(repaint()))).toBe(true);
    activity.reset();
    expect(activity.isActivity(update(repaint({ revision: 3 })))).toBe(false);
  });

  test("keeps pane memory independent per pane", () => {
    const activity = createPaneActivity();
    const other = { ...basePane, pane_id: "pane-2" };
    expect(activity.isActivity(update(basePane))).toBe(false);
    expect(activity.isActivity(update(other))).toBe(false);
    expect(activity.isActivity(update(repaint()))).toBe(true);
    expect(activity.isActivity(update({ ...other, revision: 9 }))).toBe(true);
  });

  test("treats malformed pane updates as changes", () => {
    const activity = createPaneActivity();
    expect(activity.isActivity(update(basePane))).toBe(false);
    expect(activity.isActivity({ event: "pane_updated", data: {} })).toBe(
      false,
    );
    // The malformed update cleared memory: a repaint-only update starts over.
    expect(activity.isActivity(update(repaint()))).toBe(false);
    expect(activity.isActivity(update({ ...basePane, pane_id: 7 }))).toBe(
      false,
    );
  });
});
