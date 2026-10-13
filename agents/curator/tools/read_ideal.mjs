import { git, repoRoot, MAIN } from "../../../lib/git.mjs";
import { listTraitsAt } from "../../../lib/ideal.mjs";
import { runTool } from "../../../lib/tool-io.mjs";

await runTool(async ({ ref = MAIN }) => {
	const root = repoRoot();
	return {
		ref,
		traits: listTraitsAt(root, ref),
		rules: git(["show", `${ref}:RULES.md`], { cwd: root }),
	};
});
