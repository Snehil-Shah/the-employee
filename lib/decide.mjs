// Human decisions on the ideal. Only these touch main, and only a person
// calls them (the workbench, or bin/decide.mjs); no agent has a tool for them.
//
// The `## Traits` index in SOUL.md is generated from traits/, so when changes
// are accepted out of order their index lines can conflict even though the
// trait files don't. Like a lockfile, the index is regenerated, never merged.
import { git, MAIN } from "./git.mjs";
import { writeIndex } from "./ideal.mjs";

function assertReady(root) {
	const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root });
	if (branch !== MAIN) throw new Error(`check out ${MAIN} first (on ${branch})`);
	if (git(["status", "--porcelain", "--untracked-files=no"], { cwd: root })) {
		throw new Error(`${MAIN} has uncommitted changes`);
	}
}

// Runs a cherry-pick or revert without committing, then settles the index.
function applyThenRegenerateIndex(root, args) {
	try {
		git(args, { cwd: root });
	} catch {
		const conflicted = git(["diff", "--name-only", "--diff-filter=U"], { cwd: root }).split("\n").filter(Boolean);
		if (conflicted.some((f) => f !== "SOUL.md")) {
			git(["reset", "--merge"], { cwd: root });
			throw new Error(`conflicts beyond the index: ${conflicted.join(", ")}`);
		}
		git(["checkout", "--ours", "--", "SOUL.md"], { cwd: root });
	}
	writeIndex(root);
	git(["add", "--", "SOUL.md"], { cwd: root });
}

export function accept(root, commit, approver) {
	assertReady(root);
	applyThenRegenerateIndex(root, ["cherry-pick", "--no-commit", commit]);
	// -C keeps the curator's message, trailers and authorship; the approver
	// becomes the committer.
	git(["commit", "-q", "-C", commit], { cwd: root, committer: approver });
	return git(["rev-parse", "--short", "HEAD"], { cwd: root });
}

export function revert(root, commit, approver, reason) {
	assertReady(root);
	const subject = git(["show", "-s", "--format=%s", commit], { cwd: root });
	const sha = git(["rev-parse", commit], { cwd: root });
	applyThenRegenerateIndex(root, ["revert", "--no-commit", commit]);

	const args = ["commit", "-q", "-m", `Revert "${subject}"`, "-m", `This reverts commit ${sha}.`];
	if (reason) args.push("-m", reason);
	git(args, { cwd: root, as: approver });
	return git(["rev-parse", "--short", "HEAD"], { cwd: root });
}
