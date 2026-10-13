import { git, repoRoot, branchExists, proposalBranch, commitsAhead, trailers, FAIRNESS_NOTES_REF } from "../../../lib/git.mjs";
import { runTool } from "../../../lib/tool-io.mjs";

function existingReview(root, commit) {
	try {
		return JSON.parse(git(["notes", `--ref=${FAIRNESS_NOTES_REF}`, "show", commit], { cwd: root }));
	} catch {
		return null;
	}
}

await runTool(async ({ source_id }) => {
	const root = repoRoot();
	const branch = proposalBranch(source_id);
	if (!branchExists(root, branch)) throw new Error(`no proposal for "${source_id}"`);

	// Oldest first, so the reviewer reads changes in the order they were made.
	const commits = commitsAhead(root, branch).reverse();
	return {
		branch,
		changes: commits.map((sha) => ({
			commit: sha.slice(0, 12),
			subject: git(["show", "-s", "--format=%s", sha], { cwd: root }),
			rationale: git(["show", "-s", "--format=%b", sha], { cwd: root }).split("\n\n")[0].trim(),
			trailers: trailers(root, sha),
			diff: git(["show", "--format=", sha], { cwd: root }),
			review: existingReview(root, sha),
		})),
	};
});
