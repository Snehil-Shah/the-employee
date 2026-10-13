// pre_tool_use hook: allow only the tools listed in the agent's
// hooks/allowed-tools file and block everything else, including the harness
// built-ins (cli, write, edit, memory, skill_learner) if a host forgets to
// strip them. Agents here change the ideal only through reviewed proposals.
//
// GitAgent treats a hook that crashes or prints something unparseable as
// "allow", so this script must always print a verdict, and any error is a
// block.
import { readFileSync } from "node:fs";
import { join } from "node:path";

function verdict(raw) {
	const allowed = readFileSync(join(process.cwd(), "hooks", "allowed-tools"), "utf-8")
		.split("\n")
		.map((l) => l.replace(/#.*/, "").trim())
		.filter(Boolean);

	const { tool } = JSON.parse(raw);
	if (allowed.includes(tool)) return { action: "allow" };
	return { action: "block", reason: `"${tool}" is not available to this agent. Allowed: ${allowed.join(", ") || "none"}.` };
}

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let result;
try {
	result = verdict(raw);
} catch (err) {
	result = { action: "block", reason: `tool guard failed closed: ${err.message}` };
}
process.stdout.write(JSON.stringify(result));
