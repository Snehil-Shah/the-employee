import { git, repoRoot, proposalWorktree, commitsAhead, CURATOR } from "../../../lib/git.mjs";
import { applyChange } from "../../../lib/ideal.mjs";
import { runTool } from "../../../lib/tool-io.mjs";

const MAX_CHANGES = 3;
const MAX_QUOTE = 280;
const SOURCE_ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const SOURCE_TYPES = ["hire", "reject", "exit"];
// Rejection reasons are where hiring bias concentrates, so one interviewer's
// view of a rejected candidate is never enough to reshape the ideal.
const MIN_REVIEWERS = { hire: 1, reject: 2, exit: 1 };

const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

function checkEvidence(sourceType, evidence) {
	const quotes = (evidence || [])
		.map((e) => ({ from: oneLine(e?.from), quote: oneLine(e?.quote) }))
		.filter((e) => e.quote);
	if (quotes.length < 1 || quotes.length > 3) {
		throw new Error("cite one to three verbatim quotes as evidence");
	}
	if (quotes.some((e) => !e.from)) {
		throw new Error("label every quote with the reviewer it came from, exactly as given");
	}
	if (quotes.some((e) => e.quote.length > MAX_QUOTE)) {
		throw new Error(`keep each quote under ${MAX_QUOTE} characters; quote only the words that matter`);
	}
	const reviewers = new Set(quotes.map((e) => e.from)).size;
	if (reviewers < MIN_REVIEWERS[sourceType]) {
		throw new Error(
			`a change from a ${sourceType} needs evidence from at least ${MIN_REVIEWERS[sourceType]} different reviewers; ` +
				"if only one interviewer raised it, it isn't strong enough to change the ideal",
		);
	}
	return quotes;
}

await runTool(async (args) => {
	const { source_id, source_type, change, trait, rationale, evidence } = args;
	const { title, summary, meaning, signals, not } = args;

	if (!SOURCE_ID.test(source_id || "")) {
		throw new Error("source_id must be lowercase letters, digits and dashes, as given in the task");
	}
	if (!SOURCE_TYPES.includes(source_type)) {
		throw new Error(`source_type must be one of ${SOURCE_TYPES.join(", ")}`);
	}
	const quotes = checkEvidence(source_type, evidence);

	const root = repoRoot();
	const { branch, dir } = proposalWorktree(root, source_id);

	if (commitsAhead(root, branch).length >= MAX_CHANGES) {
		throw new Error(`this source already has ${MAX_CHANGES} proposed changes, which is the limit`);
	}

	let slug;
	try {
		slug = applyChange(dir, { change, trait, title, summary, meaning, signals, not });
	} catch (err) {
		// Leave the worktree clean so the next attempt starts from the branch tip.
		git(["checkout", "--", "."], { cwd: dir });
		git(["clean", "-fdq", "--", "traits"], { cwd: dir });
		throw err;
	}

	const verb = { add: "Add", modify: "Refine", remove: "Remove" }[change];
	const subject = `${verb} trait: ${title || slug}`;

	git(["add", "-A", "--", "traits", "SOUL.md"], { cwd: dir });
	git(
		[
			"commit", "-q", "-m", subject, "-m", oneLine(rationale),
			"--trailer", `Source: ${source_id}`,
			"--trailer", `Source-Type: ${source_type}`,
			"--trailer", `Change: ${change}`,
			"--trailer", `Trait: ${slug}`,
			...quotes.flatMap((e) => ["--trailer", `Evidence: ${e.from}: "${e.quote}"`]),
			"--trailer", "Proposed-By: curator",
		],
		{ cwd: dir, as: CURATOR },
	);

	return {
		branch,
		commit: git(["rev-parse", "--short", "HEAD"], { cwd: dir }),
		subject,
		diff: git(["show", "--format=", "HEAD"], { cwd: dir }),
	};
});
