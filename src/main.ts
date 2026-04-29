import * as core from "@actions/core";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import type { PackageJson, PackageUpdate, UpdateMap } from "./types.js";
import {
  collectDependencies,
  extractBaseVersion,
  resolveAllLatest,
} from "./registry-client.js";

function getBooleanInput(name: string): boolean {
  const val = core.getInput(name).trim().toLowerCase();
  return val === "true" || val === "1" || val === "yes";
}

async function run(): Promise<void> {
  const workingDirectory = core.getInput("working-directory");
  const latest = getBooleanInput("latest");
  const registryUrl = core.getInput("registry-url");
  const token = core.getInput("token");

  const pkgPath = path.join(workingDirectory, "package.json");

  if (!fs.existsSync(pkgPath)) {
    throw new Error(`package.json not found at ${pkgPath}`);
  }

  // Step 1: Read package.json
  const pkg: PackageJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const deps = collectDependencies(pkg);

  if (Object.keys(deps).length === 0) {
    core.info("No dependencies found in package.json");
    core.setOutput("updated-packages", "{}");
    return;
  }

  // Step 2: If --latest mode, resolve versions from registry
  if (!latest) {
    // Simple mode: just run bun install
    core.info("Running bun install (standard mode)");
    execSync("bun install", { cwd: workingDirectory, stdio: "inherit" });
    core.setOutput("updated-packages", "{}");
    return;
  }

  core.info(
    `Resolving latest versions for ${Object.keys(deps).length} dependencies...`,
  );

  const resolvedMap = await resolveAllLatest(deps, registryUrl, token);

  // Step 3: Figure out which packages need updating
  const updates: UpdateMap = {};
  const installArgs: string[] = [];

  for (const [name, currentRange] of Object.entries(deps)) {
    const resolved = resolvedMap.get(name);
    if (!resolved) {
      core.debug(`Skipping ${name}: could not resolve latest version`);
      continue;
    }

    const currentBase = extractBaseVersion(currentRange);
    if (!currentBase) {
      core.debug(`Skipping ${name}: cannot parse current version "${currentRange}"`);
      continue;
    }

    // Only include packages where latest differs from current
    if (resolved.version !== currentBase) {
      updates[name] = { from: currentBase, to: resolved.version };
      installArgs.push(`${name}@${resolved.version}`);
      core.info(`  ${name}: ${currentBase} → ${resolved.version}`);
    }
  }

  if (installArgs.length === 0) {
    core.info("All dependencies are already up to date");
    // Still run bun install to ensure lockfile is synced
    execSync("bun install", { cwd: workingDirectory, stdio: "inherit" });
    core.setOutput("updated-packages", "{}");
    return;
  }

  // Step 4: Run bun install with the specific versions
  core.info(`Updating ${installArgs.length} packages...`);
  const command = `bun install ${installArgs.map((arg) => `"${arg}"`).join(" ")}`;
  execSync(command, { cwd: workingDirectory, stdio: "inherit" });

  core.setOutput("updated-packages", JSON.stringify(updates));
  core.info(`Updated ${installArgs.length} packages`);
}

async function main(): Promise<void> {
  try {
    await run();
  } catch (err) {
    if (err instanceof Error) {
      core.setFailed(err.message);
    } else {
      core.setFailed(String(err));
    }
  }
}

main();
