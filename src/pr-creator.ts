import * as core from "@actions/core";
import { getRepo, buildBody, gitCommand } from "./git-utils.js";
import type { UpdateMap } from "./types.js";

export interface CreatePrOptions {
  workingDirectory: string;
  updates: UpdateMap;
  branch: string;
  title: string;
  commitMessage: string;
  labels: string[];
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
  const { workingDirectory, updates, branch, title, commitMessage, labels } =
    opts;

  // Lazy import: @octokit/action is ESM-only and can't be imported by jest
  const { Octokit } = await import("@octokit/action");

  const baseBranch = gitCommand("rev-parse --abbrev-ref HEAD", workingDirectory);
  core.info(`Current branch: ${baseBranch}`);

  // Check if the branch already exists remotely
  const branchExists = gitCommand(
    `ls-remote --heads origin ${branch}`,
    workingDirectory,
  );
  if (branchExists) {
    core.info(`Branch "${branch}" already exists, deleting it`);
    gitCommand(`push origin --delete ${branch}`, workingDirectory);
  }

  // Create and switch to new branch
  gitCommand(`checkout -b ${branch}`, workingDirectory);
  gitConfigUser(workingDirectory);

  // Stage all changes (package.json, bun.lock, etc.)
  gitCommand("add -A", workingDirectory);

  // Check if there's anything to commit
  const status = gitCommand("status --porcelain", workingDirectory);
  if (!status) {
    core.info("No changes to commit");
    gitCommand(`checkout ${baseBranch}`, workingDirectory);
    return "";
  }

  // Commit and push
  gitCommand(
    `commit -m "${commitMessage.replace(/"/g, '\\"')}"`,
    workingDirectory,
  );
  gitCommand(`push origin ${branch}`, workingDirectory);

  // Switch back
  gitCommand(`checkout ${baseBranch}`, workingDirectory);

  // Create PR via Octokit
  const octokit = new Octokit();
  const { owner, repo } = getRepo();

  const body = buildBody(updates);

  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    head: branch,
    base: baseBranch,
    body,
  });

  core.info(`Created PR #${pr.number}: ${pr.html_url}`);

  // Add labels if specified
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
