import { describe, it, expect, afterAll } from "@jest/globals";
import { buildBody, getRepo } from "../src/git-utils.js";
import type { UpdateMap } from "../src/types.js";

describe("buildBody", () => {
  it("builds markdown body from updates", () => {
    const updates: UpdateMap = {
      lodash: { from: "4.17.0", to: "4.18.1" },
      express: { from: "4.18.0", to: "5.2.1" },
    };
    const body = buildBody(updates);
    expect(body).toContain("- **lodash**: `4.17.0` → `4.18.1`");
    expect(body).toContain("- **express**: `4.18.0` → `5.2.1`");
    expect(body).toContain("## Updated dependencies");
  });

  it("handles empty updates", () => {
    expect(buildBody({})).toBe("No updates.");
  });
});

describe("getRepo", () => {
  const original = process.env.GITHUB_REPOSITORY;

  it("parses GITHUB_REPOSITORY", () => {
    process.env.GITHUB_REPOSITORY = "my-org/my-repo";
    expect(getRepo()).toEqual({ owner: "my-org", repo: "my-repo" });
  });

  it("throws if GITHUB_REPOSITORY is not set", () => {
    delete process.env.GITHUB_REPOSITORY;
    expect(() => getRepo()).toThrow("GITHUB_REPOSITORY");
  });

  afterAll(() => {
    if (original) process.env.GITHUB_REPOSITORY = original;
  });
});
