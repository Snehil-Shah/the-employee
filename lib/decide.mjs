// Human decisions on the ideal. Only these touch main, and only a person
// calls them (the workbench, or bin/decide.mjs); no agent has a tool for them.
//
// A proposal (one branch per hire, rejection or exit) is decided as a whole.
// Accepting squashes it onto main as one commit, so main reads as a clean list
// of decisions; the proposal's own commits, with each change's rationale and
// evidence, stay on its branch. Declining leaves the branch unmerged, as the
// record of what wasn't taken.
//
// The `## Traits` index in SOUL.md is generated from traits/, so when two
// proposals change it in parallel their index lines can conflict even though
// the trait files don't. Like a lockfile, the index is regenerated, never merged.
import { git, MAIN, proposalBranch, commitsAhead, proposalWorktree, withLock } from "./git.mjs";
import { writeIndex } from "./ideal.mjs";

function assertReady(root) {
	const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: root });
	if (branch !== MAIN) throw new Error(`check out ${MAIN} first (on ${branch})`);
	if (git(["status", "--porcelain", "--untracked-files=no"], { cwd: root })) {
		throw new Error(`${MAIN} has uncommitted changes`);
	}
}

// Runs a merge or revert without committing in `cwd`, then settles the index.
function applyThenRegenerateIndex(cwd, args) {
	try {
		git(args, { cwd });
	} catch {
		const conflicted = git(["diff", "--name-only", "--diff-filter=U"], { cwd }).split("\n").filter(Boolean);
		if (conflicted.length === 0 || conflicted.some((f) => f !== "SOUL.md")) {
			git(["reset", "--merge"], { cwd });
			throw new Error(conflicted.length ? `conflicts beyond the index: ${conflicted.join(", ")}` : `git ${args[0]} failed`);
		}
		git(["checkout", "--ours", "--", "SOUL.md"], { cwd });
	}
	writeIndex(cwd);
	git(["add", "--", "SOUL.md"], { cwd });
}

// The commit on main that accepted this source's proposal, if any.
export function acceptedAs(root, sourceId) {
	const out = git(
		[
			"log", MAIN, "--first-parent",
			"--format=%H%x1f%(trailers:key=Source,valueonly,separator=)%x1f%(trailers:key=Decision,valueonly,separator=)%x1e",
		],
		{ cwd: root },
	);
	const hit = out
		.split("\x1e")
		.map((record) => record.split("\x1f").map((s) => s.trim()))
		.find(([, source, decision]) => source === sourceId && decision === "accepted");
	return hit ? hit[0] : null;
}

// The message of the commit that accepts a proposal: a title (by default the
// branch), the list of changes, and the trailers that tie it to its source.
export function acceptMessage(root, sourceId, title) {
	const branch = proposalBranch(sourceId);
	const changes = git(["log", "--reverse", "--no-merges", "--format=- %s", `${MAIN}..${branch}`], { cwd: root });
	return {
		title: title || `Accept ${branch}`,
		body: `${changes}\n\nSource: ${sourceId}\nDecision: accepted`,
	};
}

// Brings a proposal branch up to date with main (merging main into it, index
// regenerated), so it can be squashed onto main without conflicts, here or by
// a host such as GitHub. Returns true if the branch changed.
export function catchUp(root, sourceId, approver) {
	const branch = proposalBranch(sourceId);
	const behind = git(["rev-list", "--count", `${branch}..${MAIN}`], { cwd: root });
	if (behind === "0") return false;
	return withLock(root, () => {
		const { dir } = proposalWorktree(root, sourceId);
		applyThenRegenerateIndex(dir, ["merge", "--no-ff", "--no-commit", MAIN]);
		git(["commit", "-q", "-m", `Merge ${MAIN} into ${branch}`], { cwd: dir, as: approver });
		return true;
	});
}

export function accept(root, sourceId, approver, title) {
	assertReady(root);
	const branch = proposalBranch(sourceId);
	if (acceptedAs(root, sourceId)) throw new Error(`${branch} is already accepted`);
	if (commitsAhead(root, branch).length === 0) throw new Error(`${branch} has nothing to accept`);

	const message = acceptMessage(root, sourceId, title);
	applyThenRegenerateIndex(root, ["merge", "--squash", branch]);
	git(["commit", "-q", "-m", message.title, "-m", message.body], { cwd: root, as: approver });
	return git(["rev-parse", "--short", "HEAD"], { cwd: root });
}

// Undoes an accepted proposal: reverts the commit that accepted it.
export function revert(root, sourceId, approver, reason) {
	assertReady(root);
	const accepted = acceptedAs(root, sourceId);
	if (!accepted) throw new Error(`${proposalBranch(sourceId)} isn't accepted, so there's nothing to revert`);

	const subject = git(["show", "-s", "--format=%s", accepted], { cwd: root });
	applyThenRegenerateIndex(root, ["revert", "--no-commit", accepted]);
	const args = ["commit", "-q", "-m", `Revert "${subject}"`, "-m", `This reverts commit ${accepted}.`];
	if (reason) args.push("-m", reason);
	args.push("--trailer", `Source: ${sourceId}`, "--trailer", "Decision: reverted");
	git(args, { cwd: root, as: approver });
	return git(["rev-parse", "--short", "HEAD"], { cwd: root });
}
