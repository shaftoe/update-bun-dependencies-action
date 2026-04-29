import { execSync } from "node:child_process";
import type { UpdateMap } from "./types.js";

export function getRepo(): { owner: string; repo: string } {
  const repository = process.env.GITHUB_REPOSITORY;
  if (!repository) {
    throw new Error("GITHUB_REPOSITORY environment variable is not set");
  }
  const [owner, repo] = repository.split("/");
  return { owner, repo };
}

export function buildBody(updates: UpdateMap): string {
  const entries = Object.entries(updates);
  if (entries.length === 0) return "No updates.";

  const lines = entries.map(
    ([name, { from, to }]) => `- **${name}**: \`${from}\` → \`${to}\``,
  );

  return `## Updated dependencies\n\n${lines.join("\n")}\n\n> Updated by \`update-bun-dependencies-action\``;
}

export function gitCommand(args: string, cwd: string): string {
  return execSync(`git ${args}`, { cwd, stdio: ["pipe", "pipe", "pipe"] })
    .toString()
    .trim();
}
