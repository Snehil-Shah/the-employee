// The ideal is spread over two places:
//   traits/<slug>.md  one file per trait: the full, structured definition
//   SOUL.md           who the ideal is, plus a `## Traits` index generated
//                     from those files (the only part GitAgent puts in the
//                     system prompt; details are read on demand)
// The slug (file name) is a trait's stable id. Titles may change, slugs don't,
// so blame and history follow a trait across renames.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.mjs";

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const INDEX_HEADING = "## Traits";
export const EMPTY_INDEX =
	"_None yet. Nobody has explored me: traits are added only through reviewed proposals._";

const LIMITS = { summary: 140, signals: [1, 5], not: [0, 3] };

export function slugify(title) {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// ── Trait files ─────────────────────────────────────────────────────────

export function renderTrait({ title, summary, meaning, signals, not = [] }) {
	const parts = [
		`---\ntitle: ${title}\nsummary: ${summary}\n---`,
		`# ${title}`,
		meaning.trim(),
		`## You'll see it when\n${signals.map((s) => `- ${s}`).join("\n")}`,
	];
	if (not.length) parts.push(`## It isn't\n${not.map((s) => `- ${s}`).join("\n")}`);
	return `${parts.join("\n\n")}\n`;
}

export function parseTrait(text) {
	const front = text.match(/^---\n([\s\S]*?)\n---\n/);
	if (!front) throw new Error("trait file has no frontmatter");

	const meta = {};
	for (const line of front[1].split("\n")) {
		const i = line.indexOf(":");
		if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
	}

	const [head, ...sections] = text.slice(front[0].length).split(/^## /m);
	const list = (heading) => {
		const section = sections.find((s) => s.startsWith(heading));
		if (!section) return [];
		return section
			.split("\n")
			.filter((l) => l.startsWith("- "))
			.map((l) => l.slice(2).trim());
	};

	return {
		title: meta.title,
		summary: meta.summary,
		meaning: head.replace(/^\s*# .*\n/, "").trim(),
		signals: list("You'll see it when"),
		not: list("It isn't"),
	};
}

function validateTrait(t) {
	if (!oneLine(t.title)) throw new Error("a trait needs a title");
	if (!oneLine(t.summary)) throw new Error("a trait needs a one-line summary");
	if (oneLine(t.summary).length > LIMITS.summary) {
		throw new Error(`keep the summary under ${LIMITS.summary} characters`);
	}
	if (!String(t.meaning ?? "").trim()) throw new Error("a trait needs a meaning paragraph, in the first person");
	// A heading inside the meaning would read back as a new section of the file.
	if (/^\s*#/m.test(t.meaning)) throw new Error("write the meaning as plain paragraphs, without headings");
	const [minS, maxS] = LIMITS.signals;
	if (!Array.isArray(t.signals) || t.signals.length < minS || t.signals.length > maxS) {
		throw new Error(`give ${minS} to ${maxS} observable signals ("You'll see it when…")`);
	}
	const [, maxN] = LIMITS.not;
	if (t.not && t.not.length > maxN) throw new Error(`give at most ${maxN} "It isn't" lines`);
}

function normalise(t) {
	return {
		title: oneLine(t.title),
		summary: oneLine(t.summary),
		meaning: String(t.meaning).trim(),
		signals: t.signals.map(oneLine).filter(Boolean),
		not: (t.not || []).map(oneLine).filter(Boolean),
	};
}

// ── Reading the ideal ───────────────────────────────────────────────────

export function listTraits(dir) {
	const traitsDir = join(dir, "traits");
	if (!existsSync(traitsDir)) return [];
	return readdirSync(traitsDir)
		.filter((f) => f.endsWith(".md") && SLUG.test(f.slice(0, -3)))
		.sort()
		.map((f) => ({ slug: f.slice(0, -3), ...parseTrait(readFileSync(join(traitsDir, f), "utf-8")) }));
}

// Same as listTraits, but at a git ref instead of the working tree.
export function listTraitsAt(root, ref) {
	let files;
	try {
		files = git(["ls-tree", "--name-only", `${ref}:traits`], { cwd: root });
	} catch {
		return []; // no traits/ directory at this ref
	}
	return files
		.split("\n")
		.filter((f) => f.endsWith(".md") && SLUG.test(f.slice(0, -3)))
		.sort()
		.map((f) => ({ slug: f.slice(0, -3), ...parseTrait(git(["show", `${ref}:traits/${f}`], { cwd: root })) }));
}

// ── SOUL.md index ───────────────────────────────────────────────────────

export function renderIndex(traits) {
	if (traits.length === 0) return EMPTY_INDEX;
	return traits.map((t) => `- **${t.title}**: ${t.summary} (\`traits/${t.slug}.md\`)`).join("\n");
}

// Regenerates the body of the `## Traits` section from traits/; everything
// else in SOUL.md is left byte-for-byte as it was.
export function writeIndex(dir) {
	const path = join(dir, "SOUL.md");
	const soul = readFileSync(path, "utf-8");
	const marker = `\n${INDEX_HEADING}\n`;
	const start = soul.indexOf(marker);
	if (start === -1) throw new Error(`SOUL.md has no "${INDEX_HEADING}" section`);

	const bodyStart = start + marker.length;
	const next = soul.indexOf("\n## ", bodyStart);
	const rest = next === -1 ? "" : `\n${soul.slice(next).replace(/^\n+/, "")}`;
	writeFileSync(path, `${soul.slice(0, bodyStart)}\n${renderIndex(listTraits(dir))}\n${rest}`);
}

// ── Changing the ideal ──────────────────────────────────────────────────

// Applies one change inside `dir` (a proposal worktree): writes or removes
// the trait file and regenerates the index. Returns the trait's slug. Throws
// with a message the model can act on when the change doesn't fit.
export function applyChange(dir, { change, trait, ...fields }) {
	const traits = listTraits(dir);
	const known = () => traits.map((t) => t.slug).join(", ") || "none yet";
	const path = (slug) => join(dir, "traits", `${slug}.md`);

	if (change === "add") {
		const slug = slugify(fields.title || "");
		if (!slug) throw new Error("add needs a title");
		if (traits.some((t) => t.slug === slug)) throw new Error(`a trait "${slug}" already exists; propose a modify`);
		validateTrait(fields);
		mkdirSync(join(dir, "traits"), { recursive: true });
		writeFileSync(path(slug), renderTrait(normalise(fields)));
		writeIndex(dir);
		return slug;
	}

	const existing = traits.find((t) => t.slug === trait);
	if (!existing) throw new Error(`no trait "${trait}" in the ideal. Known traits: ${known()}`);

	if (change === "remove") {
		rmSync(path(trait));
		writeIndex(dir);
		return trait;
	}

	if (change === "modify") {
		// Fields left out stay as they are, so a change shows up as the
		// smallest possible diff.
		const given = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
		const updated = { ...existing, ...given };
		validateTrait(updated);
		const before = renderTrait(existing);
		const after = renderTrait(normalise(updated));
		if (after === before) throw new Error("this change leaves the trait exactly as it is");
		writeFileSync(path(trait), after);
		writeIndex(dir);
		return trait;
	}

	throw new Error(`unknown change "${change}"; use add, modify or remove`);
}
