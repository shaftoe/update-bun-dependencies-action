import * as core from "@actions/core";
import { getRepo, buildBody, gitCommand } from "./git-utils.js";
import type { UpdateMap } from "./types.js";

export type PrUpdateStrategy = "update" | "create";

export interface CreatePrOptions {
  workingDirectory: string;
  updates: UpdateMap;
  branch: string;
  title: string;
  commitMessage: string;
  labels: string[];
  /** Strategy: "update" reuse existing PR/branch, "create" makes unique branch per run */
  prUpdateStrategy: PrUpdateStrategy;
}

function gitConfigUser(cwd: string): void {
  try {
    gitCommand('config user.name "github-actions[bot]"', cwd);
    gitCommand(
      'config user.email "github-actions[bot]@users.noreply.github.com"',
      cwd,
    );
  } catch {
    // In GITHUB_TOKEN auth, the bot identity is automatic
  }
}

/**
 * Create a pull request with the updated files.
 * Handles: branch creation, commit, push, PR creation/opening.
 */
export async function createPullRequest(
  opts: CreatePrOptions,
): Promise<string> {
  const { workingDirectory, updates, title, commitMessage, labels } =
    opts;
  const branch = opts.branch;
  const strategy = opts.prUpdateStrategy ?? "update";

  // Lazy import: @octokit/action is ESM-only and can't be imported by jest
  const { Octokit } = await import("@octokit/action");

  const baseBranch = gitCommand("rev-parse --abbrev-ref HEAD", workingDirectory);
  core.info(`Current branch: ${baseBranch}`);

  const octokit = new Octokit();
  const { owner, repo } = getRepo();

  // ── "update" strategy: reuse existing branch & PR ──────────────────────
  if (strategy === "update") {
    // Check for an existing open PR from this branch
    let existingPR: { number: number; html_url: string } | undefined;
    try {
      const { data: existingPRs } = await octokit.rest.pulls.list({
        owner,
        repo,
        head: `${owner}:${branch}`,
        state: "open",
      });
      if (existingPRs.length > 0) {
        existingPR = existingPRs[0];
        core.info(`Found existing PR #${existingPR.number} for branch ${branch}`);
      }
    } catch {
      // Non-critical: proceed as if no existing PR
    }

    // Create or reset the local branch from current HEAD.
    // -B (uppercase) creates the branch if it doesn't exist or resets it if
    //   it does — both pointing at the current commit.
    // Uncommitted working-tree changes (bun install output) are preserved.
    // The subsequent force-push overwrites whatever was on the remote.
    gitCommand(`checkout -B ${branch}`, workingDirectory);

    gitConfigUser(workingDirectory);
    gitCommand("add -A", workingDirectory);

    const status = gitCommand("status --porcelain", workingDirectory);
    if (!status) {
      core.info("No changes to commit — everything is already up to date");
      gitCommand(`checkout ${baseBranch}`, workingDirectory);
      return existingPR?.html_url ?? "";
    }

    gitCommand(
      `commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
      workingDirectory,
    );
    gitCommand(`push --force origin ${branch}`, workingDirectory);
    gitCommand(`checkout ${baseBranch}`, workingDirectory);

    const body = buildBody(updates);

    if (existingPR) {
      // Update the existing PR's title and body
      await octokit.rest.pulls.update({
        owner,
        repo,
        pull_number: existingPR.number,
        title,
        body,
      });
      core.info(`Updated existing PR #${existingPR.number}: ${existingPR.html_url}`);

      // Ensure labels are set
      if (labels.length > 0) {
        await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: existingPR.number,
          labels,
        });
      }

      return existingPR.html_url;
    }

    // No existing PR — create one
    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      head: branch,
      base: baseBranch,
      body,
    });

    core.info(`Created PR #${pr.number}: ${pr.html_url}`);

    if (labels.length > 0) {
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: pr.number,
        labels,
      });
    }

    return pr.html_url;
  }

  // ── "create" strategy: unique branch per run (legacy behavior) ─────────
  const suffix = process.env.GITHUB_RUN_ID ?? Date.now().toString();
  const uniqueBranch = `${branch}-${suffix}`;
  core.info(`Using unique branch name: ${uniqueBranch}`);

  gitCommand(`checkout -b ${uniqueBranch}`, workingDirectory);
  gitConfigUser(workingDirectory);
  gitCommand("add -A", workingDirectory);

  const status = gitCommand("status --porcelain", workingDirectory);
  if (!status) {
    core.info("No changes to commit");
    gitCommand(`checkout ${baseBranch}`, workingDirectory);
    return "";
  }

  gitCommand(
    `commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
    workingDirectory,
  );
  gitCommand(`push origin ${uniqueBranch}`, workingDirectory);
  gitCommand(`checkout ${baseBranch}`, workingDirectory);

  const body = buildBody(updates);

  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    head: uniqueBranch,
    base: baseBranch,
    body,
  });

  core.info(`Created PR #${pr.number}: ${pr.html_url}`);

  if (labels.length > 0) {
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels,
    });
  }

  return pr.html_url;
}
