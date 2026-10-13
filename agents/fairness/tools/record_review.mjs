import { git, repoRoot, withLock, MAIN, PROPOSAL_PREFIX, FAIRNESS, FAIRNESS_NOTES_REF } from "../../../lib/git.mjs";
import { runTool } from "../../../lib/tool-io.mjs";

await runTool(async ({ commit, verdict, summary, concerns = [] }) => {
	const root = repoRoot();
	const sha = git(["rev-parse", "--verify", `${commit}^{commit}`], { cwd: root });

	// Reviews belong on proposals only: the commit must sit on a proposal
	// branch and must not already be part of the approved ideal.
	const onProposal = git(["branch", "--list", `${PROPOSAL_PREFIX}*`, "--contains", sha], { cwd: root });
	const onMain = git(["branch", "--list", MAIN, "--contains", sha], { cwd: root });
	if (!onProposal || onMain) throw new Error(`${commit} is not a pending proposal commit`);

	if (verdict === "flagged" && concerns.length === 0) {
		throw new Error("a flagged verdict needs at least one concern with term, why and suggestion");
	}

	const note = { verdict, summary, concerns, reviewed_at: new Date().toISOString() };
	withLock(root, () =>
		git(["notes", `--ref=${FAIRNESS_NOTES_REF}`, "add", "-f", "-F", "-", sha], {
			cwd: root,
			as: FAIRNESS,
			input: JSON.stringify(note, null, 2),
		}),
	);

	return { commit: sha.slice(0, 12), verdict };
});
