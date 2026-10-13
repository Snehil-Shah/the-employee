#!/usr/bin/env node
// Accept or revert a change to the ideal from the command line, as the person
// in your git config.
//
//   node bin/decide.mjs accept <commit>
//   node bin/decide.mjs revert <commit> [reason]
import { git, repoRoot } from "../lib/git.mjs";
import { accept, revert } from "../lib/decide.mjs";

const [action, commit, ...reason] = process.argv.slice(2);
const root = repoRoot();
const me = {
	name: git(["config", "user.name"], { cwd: root }),
	email: git(["config", "user.email"], { cwd: root }),
};

try {
	if (action === "accept" && commit) {
		console.log(`accepted as ${accept(root, commit, me)}`);
	} else if (action === "revert" && commit) {
		console.log(`reverted as ${revert(root, commit, me, reason.join(" "))}`);
	} else {
		console.error("usage: decide.mjs accept <commit> | revert <commit> [reason]");
		process.exit(2);
	}
} catch (err) {
	console.error(err.message);
	process.exit(1);
}
