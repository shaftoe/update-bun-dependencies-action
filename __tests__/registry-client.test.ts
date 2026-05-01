import { describe, it, expect } from "@jest/globals";
import {
  collectDependencies,
  isNpmRegistryDep,
  extractBaseVersion,
  extractVersionPrefix,
  resolveLatestVersion,
} from "../src/registry-client.js";

describe("collectDependencies", () => {
  it("collects from all dependency sections", () => {
    const pkg = {
      dependencies: { lodash: "^4.17.0" },
      devDependencies: { prettier: "^3.4.0" },
      optionalDependencies: { fsevents: "^2.3.0" },
      peerDependencies: { react: "^18.0.0" },
    };
    const result = collectDependencies(pkg);
    expect(result).toEqual({
      lodash: "^4.17.0",
      prettier: "^3.4.0",
      fsevents: "^2.3.0",
      react: "^18.0.0",
    });
  });

  it("returns empty for empty package.json", () => {
    expect(collectDependencies({})).toEqual({});
  });

  it("skips undefined sections", () => {
    expect(collectDependencies({ dependencies: { foo: "1.0.0" } })).toEqual({
      foo: "1.0.0",
    });
  });
});

describe("isNpmRegistryDep", () => {
  it("accepts semver ranges", () => {
    expect(isNpmRegistryDep("^4.17.0")).toBe(true);
    expect(isNpmRegistryDep("~4.17.0")).toBe(true);
    expect(isNpmRegistryDep(">=1.0.0")).toBe(true);
    expect(isNpmRegistryDep("1.0.0")).toBe(true);
    expect(isNpmRegistryDep("*")).toBe(true);
    expect(isNpmRegistryDep("x.x.x")).toBe(true);
    expect(isNpmRegistryDep("||")).toBe(true);
  });

  it("rejects non-npm deps", () => {
    expect(isNpmRegistryDep("workspace:*")).toBe(false);
    expect(isNpmRegistryDep("workspace:^")).toBe(false);
    expect(isNpmRegistryDep("file:../pkg")).toBe(false);
    expect(isNpmRegistryDep("link:../pkg")).toBe(false);
    expect(isNpmRegistryDep("portal:../pkg")).toBe(false);
    expect(isNpmRegistryDep("git+https://github.com/user/repo.git")).toBe(
      false,
    );
    expect(isNpmRegistryDep("github:user/repo")).toBe(false);
    expect(isNpmRegistryDep("npm:pkg@1.0.0")).toBe(false);
    expect(isNpmRegistryDep("https://example.com/pkg.tgz")).toBe(false);
  });
});

describe("extractBaseVersion", () => {
  it("extracts version from prefixed ranges", () => {
    expect(extractBaseVersion("^4.17.0")).toBe("4.17.0");
    expect(extractBaseVersion("~4.17.0")).toBe("4.17.0");
    expect(extractBaseVersion(">=1.0.0")).toBe("1.0.0");
    expect(extractBaseVersion("<=2.0.0")).toBe("2.0.0");
  });

  it("extracts exact versions", () => {
    expect(extractBaseVersion("4.17.0")).toBe("4.17.0");
  });

  it("returns null for unparseable versions", () => {
    expect(extractBaseVersion("*")).toBeNull();
    expect(extractBaseVersion("latest")).toBeNull();
    expect(extractBaseVersion("")).toBeNull();
  });
});

describe("extractVersionPrefix", () => {
  it("extracts prefix from caret ranges", () => {
    expect(extractVersionPrefix("^4.17.0")).toBe("^");
  });

  it("extracts prefix from tilde ranges", () => {
    expect(extractVersionPrefix("~4.17.0")).toBe("~");
  });

  it("extracts prefix from comparison ranges", () => {
    expect(extractVersionPrefix(">=1.0.0")).toBe(">=");
    expect(extractVersionPrefix("<=2.0.0")).toBe("<=");
  });

  it("returns empty string for exact versions", () => {
    expect(extractVersionPrefix("4.17.0")).toBe("");
  });
});

describe("resolveLatestVersion", () => {
  // Integration test against real registry (can be skipped in offline CI)
  it(
    "resolves lodash latest from npm registry",
    async () => {
      const result = await resolveLatestVersion(
        "lodash",
        "https://registry.npmjs.org",
      );
      expect(result).not.toBeNull();
      expect(result!.version).toMatch(/^\d+\.\d+\.\d+$/);
    },
    10_000,
  );

  it(
    "resolves scoped package from npm registry",
    async () => {
      const result = await resolveLatestVersion(
        "@actions/core",
        "https://registry.npmjs.org",
      );
      expect(result).not.toBeNull();
      expect(result!.version).toMatch(/^\d+\.\d+\.\d+$/);
    },
    10_000,
  );

  it("returns null for non-existent package", async () => {
    const result = await resolveLatestVersion(
      "this-package-definitely-does-not-exist-xyzzy-12345",
      "https://registry.npmjs.org",
    );
    expect(result).toBeNull();
  });
});
