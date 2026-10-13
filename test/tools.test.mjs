// Exercises the tool scripts and hook guard the way GitAgent runs them: a
// child process per call, JSON on stdin, cwd = the agent's directory. Runs
// against a throwaway copy of this repo, so no model or API key is needed.
// Tests run in order and build on each other: the ideal starts empty and
// grows through one proposal.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTrait, renderTrait, writeIndex, EMPTY_INDEX } from "../lib/ideal.mjs";
import { accept, revert } from "../lib/decide.mjs";

const SOURCE = join(dirname(fileURLToPath(import.meta.url)), "..");
const HEAD_OF_PEOPLE = { name: "Head of People", email: "people@example.com" };
let repo;

const git = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf-8" }).trim();

function tool(agentPath, script, args) {
	const cwd = join(repo, agentPath);
	const r = spawnSync("node", [join(cwd, "tools", script)], { cwd, input: JSON.stringify(args), encoding: "utf-8" });
	if (r.status !== 0) return { error: r.stderr.trim() };
	return JSON.parse(r.stdout).result;
}

function guard(agentPath, toolName) {
	const cwd = join(repo, agentPath);
	const r = spawnSync("sh", [join(cwd, "hooks", "guard.sh")], { cwd, input: JSON.stringify({ tool: toolName }), encoding: "utf-8" });
	return JSON.parse(r.stdout).action;
}

const proposal = {
	source_id: "exit-test-01",
	source_type: "exit",
	rationale: "Onboarding cost repeats for every future hire.",
	evidence: [{ from: "Exit notes", quote: "I spent my first month rebuilding context nobody had written down." }],
};

const rejectLoop = {
	source_id: "reject-test-01",
	source_type: "reject",
	change: "add",
	title: "Chooses the simplest thing that works",
	summary: "Picks the simplest tool that solves the problem and can say why.",
	meaning: "I choose the simplest design that meets the need, and I can explain the trade-off.",
	signals: ["can say what a chosen tool solves that a simpler one wouldn't"],
	rationale: "Two interviewers independently saw complexity chosen without a reason.",
	evidence: [
		{ from: "Interviewer 1 (system design)", quote: "Picked Kafka without being able to say what problem it solved." },
		{ from: "Interviewer 2 (pairing)", quote: "Reached for the heaviest tool each time." },
	],
};

const writesThingsDown = {
	...proposal,
	change: "add",
	title: "Writes things down",
	summary: "Writes decisions and their reasons where the next person will find them.",
	meaning: "I write the decision, the reason, and the options we rejected.",
	signals: ["a new teammate answers 'why is it built this way?' from my notes"],
	not: ["writing long documents nobody reads"],
};

before(() => {
	repo = mkdtempSync(join(tmpdir(), "the-employee-"));
	cpSync(SOURCE, repo, {
		recursive: true,
		filter: (src) => !/[/\\](\.git|\.proposals|\.gitagent|node_modules)([/\\]|$)/.test(src.slice(SOURCE.length)),
	});
	git("init", "-q", "-b", "main");
	git("add", "-A");
	git("-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-q", "-m", "Initial framework");
});

test("the base ideal is unexplored", () => {
	assert.deepEqual(tool("agents/curator", "read_ideal.mjs", {}).traits, []);
	assert.match(readFileSync(join(repo, "SOUL.md"), "utf-8"), new RegExp(EMPTY_INDEX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
	assert.match(tool(".", "read_trait.mjs", { trait: "anything" }).error, /no traits yet/);
});

test("regenerating the index of the base SOUL.md changes nothing", () => {
	const before = readFileSync(join(repo, "SOUL.md"), "utf-8");
	writeIndex(repo);
	assert.equal(readFileSync(join(repo, "SOUL.md"), "utf-8"), before);
});

test("trait files round-trip byte for byte", () => {
	const text = renderTrait(writesThingsDown);
	assert.equal(renderTrait(parseTrait(text)), text);
});

test("an add writes the trait file and its index line on a proposal branch only", () => {
	const mainBefore = git("rev-parse", "main");
	const r = tool("agents/curator", "propose_change.mjs", writesThingsDown);

	assert.equal(r.branch, "proposal/exit-test-01");
	assert.equal(git("rev-parse", "main"), mainBefore);

	const trait = parseTrait(git("show", "proposal/exit-test-01:traits/writes-things-down.md"));
	assert.equal(trait.title, "Writes things down");
	assert.deepEqual(trait.not, ["writing long documents nobody reads"]);
	assert.match(git("show", "proposal/exit-test-01:SOUL.md"), /- \*\*Writes things down\*\*: Writes decisions/);
	assert.doesNotMatch(readFileSync(join(repo, "SOUL.md"), "utf-8"), /Writes things down/);

	const message = git("show", "-s", "--format=%an|%B", "proposal/exit-test-01");
	assert.match(message, /^Curator \(the-employee\)\|Add trait: Writes things down/);
	assert.match(message, /Trait: writes-things-down/);
	assert.match(message, /Evidence: Exit notes: "I spent my first month/);
});

test("a reject needs two different interviewers behind it", () => {
	const oneInterviewer = tool("agents/curator", "propose_change.mjs", {
		...rejectLoop,
		evidence: [rejectLoop.evidence[0], { ...rejectLoop.evidence[1], from: rejectLoop.evidence[0].from }],
	});
	assert.match(oneInterviewer.error, /at least 2 different reviewers/);

	const unlabelled = tool("agents/curator", "propose_change.mjs", { ...rejectLoop, evidence: [{ quote: "no label" }] });
	assert.match(unlabelled.error, /label every quote/);

	const r = tool("agents/curator", "propose_change.mjs", rejectLoop);
	assert.equal(r.branch, "proposal/reject-test-01");
	const trailers = git("show", "-s", "--format=%(trailers:key=Evidence,valueonly)", "proposal/reject-test-01");
	assert.match(trailers, /^Interviewer 1 \(system design\): "Picked Kafka/m);
	assert.match(trailers, /^Interviewer 2 \(pairing\): "Reached for/m);
});

test("a partial modify touches only the trait file", () => {
	tool("agents/curator", "propose_change.mjs", {
		...proposal,
		change: "modify",
		trait: "writes-things-down",
		signals: ["a new teammate ramps up from my notes in their first week"],
	});
	const changed = git("show", "--name-only", "--format=", "proposal/exit-test-01");
	assert.equal(changed, "traits/writes-things-down.md");
});

test("invalid changes are explained and leave the proposal clean", () => {
	const unknown = tool("agents/curator", "propose_change.mjs", { ...proposal, change: "modify", trait: "is-a-rockstar", summary: "x" });
	assert.match(unknown.error, /no trait "is-a-rockstar".*Known traits: writes-things-down/);

	const noSignals = tool("agents/curator", "propose_change.mjs", { ...writesThingsDown, title: "Ships", signals: [] });
	assert.match(noSignals.error, /observable signals/);
	assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: join(repo, ".proposals", "exit-test-01"), encoding: "utf-8" }), "");
});

test("a source is capped at three changes", () => {
	assert.ok(tool("agents/curator", "propose_change.mjs", { ...writesThingsDown, title: "Asks for help early" }).commit);
	assert.match(tool("agents/curator", "propose_change.mjs", { ...writesThingsDown, title: "Fourth" }).error, /limit/);
});

test("record_review attaches a note without changing the commit", () => {
	const [first] = tool("agents/fairness", "read_proposal.mjs", { source_id: "exit-test-01" }).changes;
	assert.equal(first.trailers.Trait[0], "writes-things-down");
	assert.match(first.diff, /traits\/writes-things-down\.md/);
	assert.equal(first.review, null);

	const headBefore = git("rev-parse", "proposal/exit-test-01");
	const r = tool("agents/fairness", "record_review.mjs", { commit: first.commit, verdict: "clear", summary: "Behavioural, no proxies." });
	assert.equal(r.verdict, "clear");
	assert.equal(git("rev-parse", "proposal/exit-test-01"), headBefore);

	const [reviewed] = tool("agents/fairness", "read_proposal.mjs", { source_id: "exit-test-01" }).changes;
	assert.equal(reviewed.review.verdict, "clear");
});

test("record_review refuses commits that are already on main", () => {
	const r = tool("agents/fairness", "record_review.mjs", { commit: "main", verdict: "clear", summary: "x" });
	assert.match(r.error, /not a pending proposal commit/);
});

test("changes can be accepted out of order; the index is regenerated, not merged", () => {
	const [addWrites, , addAsks] = tool("agents/fairness", "read_proposal.mjs", { source_id: "exit-test-01" }).changes;

	accept(repo, addAsks.commit, HEAD_OF_PEOPLE);
	accept(repo, addWrites.commit, HEAD_OF_PEOPLE);

	const index = readFileSync(join(repo, "SOUL.md"), "utf-8");
	assert.match(index, /- \*\*Asks for help early\*\*.*\n- \*\*Writes things down\*\*/);
	assert.doesNotMatch(index, /None yet/);

	const trait = tool(".", "read_trait.mjs", { trait: "writes-things-down" });
	assert.equal(trait.summary, "Writes decisions and their reasons where the next person will find them.");
	assert.equal(
		git("log", "-1", "--format=%an|%cn|%(trailers:key=Source,valueonly)", "--", "traits/writes-things-down.md"),
		"Curator (the-employee)|Head of People|exit-test-01",
	);
});

test("an accepted change can be reverted", () => {
	const addAsks = git("log", "--format=%h", "--grep=Add trait: Asks for help early", "main");
	revert(repo, addAsks, HEAD_OF_PEOPLE, "Over-corrected after one exit.");

	assert.match(tool(".", "read_trait.mjs", { trait: "asks-for-help-early" }).error, /I have: writes-things-down/);
	assert.doesNotMatch(readFileSync(join(repo, "SOUL.md"), "utf-8"), /Asks for help early/);
	assert.match(git("log", "-1", "--format=%an|%B"), /^Head of People\|Revert "Add trait: Asks for help early"[\s\S]*Over-corrected/);
});

test("guards allow only each agent's own tools", () => {
	assert.equal(guard(".", "read_trait"), "allow");
	assert.equal(guard(".", "memory"), "block");
	assert.equal(guard("agents/curator", "propose_change"), "allow");
	assert.equal(guard("agents/curator", "cli"), "block");
	assert.equal(guard("agents/curator", "skill_learner"), "block");
	assert.equal(guard("agents/fairness", "record_review"), "allow");
	assert.equal(guard("agents/fairness", "propose_change"), "block");
});

test("the guard fails closed on input it can't read", () => {
	const cwd = join(repo, "agents", "curator");
	const r = spawnSync("sh", [join(cwd, "hooks", "guard.sh")], { cwd, input: "not json", encoding: "utf-8" });
	assert.equal(r.status, 0);
	assert.equal(JSON.parse(r.stdout).action, "block");
});

test("a meaning with headings is refused, since it would corrupt the trait file", () => {
	const r = tool("agents/curator", "propose_change.mjs", {
		...writesThingsDown,
		source_id: "hire-test-01",
		source_type: "hire",
		title: "Ships small",
		meaning: "I ship small changes.\n\n## You'll see it when\n- smuggled signal",
	});
	assert.match(r.error, /without headings/);
});
