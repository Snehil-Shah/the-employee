// Reads from the working tree, not a git ref: the ideal answers as whatever
// version is checked out where it runs (main, or an older commit's worktree).
import { listTraits } from "../lib/ideal.mjs";
import { runTool } from "../lib/tool-io.mjs";

await runTool(async ({ trait }) => {
	const traits = listTraits(process.cwd());
	const found = traits.find((t) => t.slug === trait);
	if (!found) {
		const known = traits.map((t) => t.slug).join(", ");
		throw new Error(known ? `no trait "${trait}". I have: ${known}` : "I have no traits yet");
	}
	return found;
});
