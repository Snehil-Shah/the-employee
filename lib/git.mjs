// Thin wrapper over the git CLI. Arguments always go through argv, never a
// shell string: tool input comes from a model, so it is untrusted.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export const MAIN = process.env.THE_EMPLOYEE_MAIN || "main";
export const PROPOSAL_PREFIX = "proposal/";
export const FAIRNESS_NOTES_REF = "fairness";

export const CURATOR = { name: "Curator (the-employee)", email: "curator@the-employee.local" };
export const FAIRNESS = { name: "Fairness reviewer (the-employee)", email: "fairness@the-employee.local" };

// `as` sets author and committer (agents); `committer` sets only the
// committer, so a human approving a curator's commit keeps the curator as
// author.
export function git(args, { cwd, as, committer, input } = {}) {
	const env = { ...process.env };
	if (as) {
		env.GIT_AUTHOR_NAME = env.GIT_COMMITTER_NAME = as.name;
		env.GIT_AUTHOR_EMAIL = env.GIT_COMMITTER_EMAIL = as.email;
	}
	if (committer) {
		env.GIT_COMMITTER_NAME = committer.name;
		env.GIT_COMMITTER_EMAIL = committer.email;
	}
	return execFileSync("git", args, { cwd, env, input, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trimEnd();
}

// Tool scripts run with cwd = their agent's directory (agents/<name>), which
// sits inside the company repo, so the toplevel is the repo that holds the ideal.
export function repoRoot(cwd = process.cwd()) {
	return git(["rev-parse", "--show-toplevel"], { cwd });
}

export function branchExists(root, branch) {
	try {
		git(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: root });
		return true;
	} catch {
		return false;
	}
}

export function proposalBranch(sourceId) {
	return `${PROPOSAL_PREFIX}${sourceId}`;
}

// Proposals are written in a dedicated worktree so the main checkout (which
// the workbench and the ideal agent read from) is never touched by an agent.
export function proposalWorktree(root, sourceId) {
	const branch = proposalBranch(sourceId);
	const dir = join(root, ".proposals", sourceId);
	if (existsSync(dir)) return { branch, dir };

	mkdirSync(join(root, ".proposals"), { recursive: true });
	if (branchExists(root, branch)) {
		git(["worktree", "add", dir, branch], { cwd: root });
	} else {
		git(["worktree", "add", "-b", branch, dir, MAIN], { cwd: root });
	}
	return { branch, dir };
}

export function commitsAhead(root, branch) {
	const out = git(["rev-list", `${MAIN}..${branch}`], { cwd: root });
	return out ? out.split("\n") : [];
}

export function trailers(root, commit) {
	const out = git(["show", "-s", "--format=%(trailers:unfold,only)", commit], { cwd: root });
	const result = {};
	for (const line of out.split("\n").filter(Boolean)) {
		const i = line.indexOf(":");
		const key = line.slice(0, i).trim();
		const value = line.slice(i + 1).trim();
		(result[key] ||= []).push(value);
	}
	return result;
}
