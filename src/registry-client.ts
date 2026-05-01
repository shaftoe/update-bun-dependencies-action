import type { PackageJson, DependencyMap, ResolvedLatest } from "./types.js";

/** Dependency sections to scan, in order */
const DEP_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

/**
 * Collect all dependency names + their version ranges from a package.json.
 * Returns a flat map; later sections overwrite earlier ones (shouldn't conflict).
 */
export function collectDependencies(pkg: PackageJson): DependencyMap {
  const result: DependencyMap = {};
  for (const section of DEP_SECTIONS) {
    const deps = pkg[section];
    if (deps) {
      for (const [name, version] of Object.entries(deps)) {
        result[name] = version;
      }
    }
  }
  return result;
}

/**
 * Determine if a version range refers to an npm-published package
 * (as opposed to workspace:, file:, git url, npm alias, etc.)
 */
export function isNpmRegistryDep(version: string): boolean {
  // Skip workspace protocols, local paths, git urls, tarballs, npm aliases
  if (
    version.startsWith("workspace:") ||
    version.startsWith("file:") ||
    version.startsWith("link:") ||
    version.startsWith("portal:") ||
    version.startsWith("git:") ||
    version.startsWith("git+") ||
    version.startsWith("github:") ||
    version.startsWith("http:") ||
    version.startsWith("https:") ||
    version.startsWith("npm:")
  ) {
    return false;
  }

  // Must start with a valid semver-ish prefix: digit, ^, ~, >, <, =, x, *, ||
  return /^[0-9^~>=<x*|]/.test(version);
}

/**
 * Extract the semver version from a range string, ignoring prefix characters.
 * For example: "^4.17.0" → "4.17.0", ">=1.0.0" → "1.0.0"
 * Returns null if we can't extract a clean version.
 */
export function extractBaseVersion(version: string): string | null {
  // Strip common prefixes: ^, ~, >=, <=, >, <, =
  const match = version.match(/^[^0-9]*([0-9]+\.[0-9]+\.[0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Extract the prefix characters from a version range string.
 * For example: "^4.17.0" → "^", ">=1.0.0" → ">=", "4.17.0" → ""
 */
export function extractVersionPrefix(version: string): string {
  const match = version.match(/^([^0-9]*)/);
  return match ? match[1] : "";
}

/**
 * Resolve the latest version for a package from the npm registry.
 * Uses the dist-tags.latest field from the registry response.
 */
export async function resolveLatestVersion(
  packageName: string,
  registryUrl: string,
  token?: string,
): Promise<ResolvedLatest | null> {
  // Encode scoped packages: @storybook/addons → @storybook%2Faddons
  let encodedName = packageName;
  if (packageName.includes("/")) {
    encodedName = packageName.replace("/", "%2F");
  }

  const url = `${registryUrl.replace(/\/$/, "")}/${encodedName}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "update-bun-dependencies-action",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      "dist-tags"?: Record<string, string>;
      error?: string;
    };

    if (body.error) {
      return null;
    }

    const latest = body["dist-tags"]?.latest;
    if (!latest) {
      return null;
    }

    return { version: latest };
  } catch {
    return null;
  }
}

/**
 * Resolve latest versions for all given dependencies in parallel,
 * with a concurrency limit to avoid overwhelming the registry.
 */
export async function resolveAllLatest(
  deps: DependencyMap,
  registryUrl: string,
  token?: string,
  concurrency: number = 16,
): Promise<Map<string, ResolvedLatest>> {
  const entries = Object.entries(deps).filter(([_, version]) =>
    isNpmRegistryDep(version),
  );

  const results = new Map<string, ResolvedLatest>();
  const queue = [...entries];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;
      const [name, _version] = entry;
      const resolved = await resolveLatestVersion(name, registryUrl, token);
      if (resolved) {
        results.set(name, resolved);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, entries.length) },
    () => worker(),
  );
  await Promise.all(workers);

  return results;
}
