import { describe, expect, it } from "vitest";
import { applyChunkAction, buildThreeWayChunks } from "./threeWay";

describe("threeWay merge helpers", () => {
  it("detects conflicts when left and right touch same base lines", () => {
    const base = "alpha\nbravo\ncharlie\n";
    const left = "alpha\nbravo-left\ncharlie\n";
    const right = "alpha\nbravo-right\ncharlie\n";

    const chunks = buildThreeWayChunks(base, left, right);
    const conflict = chunks.find((chunk) => chunk.kind === "conflict");

    expect(conflict).toBeTruthy();
    expect(conflict?.leftRange).toBeTruthy();
    expect(conflict?.rightRange).toBeTruthy();
  });

  it("applies left or right chunk replacements to the base", () => {
    const base = "alpha\nbravo\ncharlie\n";
    const left = "alpha\nbravo-left\ncharlie\n";
    const right = "alpha\nbravo-right\ncharlie\n";

    const chunks = buildThreeWayChunks(base, left, right);
    const target = chunks[0];

    const applyLeft = applyChunkAction(base, left, right, target, "apply_left");
    expect(applyLeft).toContain("bravo-left");

    const applyRight = applyChunkAction(base, left, right, target, "apply_right");
    expect(applyRight).toContain("bravo-right");
  });

  it("keeps base when action is keep_base or manual", () => {
    const base = "one\ntwo\n";
    const left = "one\ntwo-left\n";
    const right = "one\ntwo-right\n";

    const [chunk] = buildThreeWayChunks(base, left, right);
    expect(applyChunkAction(base, left, right, chunk, "keep_base")).toBe(base);
    expect(applyChunkAction(base, left, right, chunk, "manual")).toBe(base);
  });
});
