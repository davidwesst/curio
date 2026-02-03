import { describe, expect, it } from "vitest";
import { placeholder } from "../src/index";

describe("placeholder", () => {
  it("returns a stable identifier", () => {
    expect(placeholder()).toBe("curio-core");
  });
});
