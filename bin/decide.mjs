#!/usr/bin/env node
// Accept or revert a proposal from the command line, as the person in your
// git config. A proposal is one hire, rejection or exit, decided as a whole.
//
//   node bin/decide.mjs accept <source-id>
//   node bin/decide.mjs revert <source-id> [reason]
import { git, repoRoot } from "../lib/git.mjs";
import { accept, revert } from "../lib/decide.mjs";

const [action, sourceId, ...reason] = process.argv.slice(2);
const root = repoRoot();
const me = {
	name: git(["config", "user.name"], { cwd: root }),
	email: git(["config", "user.email"], { cwd: root }),
};

try {
	if (action === "accept" && sourceId) {
		console.log(`merged into main as ${accept(root, sourceId, me)}`);
	} else if (action === "revert" && sourceId) {
		console.log(`reverted as ${revert(root, sourceId, me, reason.join(" "))}`);
	} else {
		console.error("usage: decide.mjs accept <source-id> | revert <source-id> [reason]");
		process.exit(2);
	}
} catch (err) {
	console.error(err.message);
	process.exit(1);
}
