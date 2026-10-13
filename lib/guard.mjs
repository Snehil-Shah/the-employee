// pre_tool_use hook: allow only the tools listed in the agent's
// hooks/allowed-tools file and block everything else, including the harness
// built-ins (cli, write, edit, memory, skill_learner) if a host forgets to
// strip them. Agents here change the ideal only through reviewed proposals.
//
// A line is either a tool name, or a tool name and a directory: `read skills/`
// allows `read` only for paths inside the agent's skills/ directory, so an
// agent can load its skills without being able to read anything else.
//
// GitAgent treats a hook that crashes or prints something unparseable as
// "allow", so this script must always print a verdict, and any error is a
// block.
import { readFileSync } from "node:fs";
import { join, resolve, relative, isAbsolute, sep } from "node:path";

function rules() {
	return readFileSync(join(process.cwd(), "hooks", "allowed-tools"), "utf-8")
		.split("\n")
		.map((l) => l.replace(/#.*/, "").trim())
		.filter(Boolean)
		.map((l) => {
			const [tool, dir] = l.split(/\s+/);
			return { tool, dir };
		});
}

function inside(dir, path) {
	if (typeof path !== "string" || !path) return false;
	const base = resolve(process.cwd(), dir);
	const rel = relative(base, resolve(process.cwd(), path));
	return rel !== "" && !rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel);
}

function verdict(raw) {
	const allowed = rules();
	const { tool, args = {} } = JSON.parse(raw);
	const rule = allowed.find((r) => r.tool === tool);
	const list = allowed.map((r) => (r.dir ? `${r.tool} (${r.dir} only)` : r.tool)).join(", ") || "none";

	if (!rule) return { action: "block", reason: `"${tool}" is not available to this agent. Allowed: ${list}.` };
	if (!rule.dir || inside(rule.dir, args.path)) return { action: "allow" };

	// Models often drop the directory ("read-reviews/SKILL.md"); point the
	// call at the same path inside it rather than refusing.
	const within = typeof args.path === "string" && !isAbsolute(args.path) ? join(rule.dir, args.path) : null;
	if (within && inside(rule.dir, within)) return { action: "modify", args: { ...args, path: within } };
	return { action: "block", reason: `"${tool}" is only allowed inside ${rule.dir}` };
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
