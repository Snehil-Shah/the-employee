// GitAgent declarative tools receive their arguments as JSON on stdin and
// return whatever they print. Errors go to stderr with a non-zero exit, which
// the harness hands back to the model as a failed tool call.

export async function readArgs() {
	let raw = "";
	for await (const chunk of process.stdin) raw += chunk;
	return raw.trim() ? JSON.parse(raw) : {};
}

export function respond(result) {
	process.stdout.write(JSON.stringify({ result }, null, 2));
}

export function fail(message) {
	process.stderr.write(`${message}\n`);
	process.exit(1);
}

export async function runTool(handler) {
	try {
		respond(await handler(await readArgs()));
	} catch (err) {
		fail(err.message);
	}
}
