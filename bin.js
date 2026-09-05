#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0

import { readFile, writeFile } from "node:fs/promises";
import { argv, exit, stderr, versions } from "node:process";
import { debuglog, parseArgs } from "node:util";

delete Object.prototype.__proto__;
Object.freeze(Object.prototype);
Object.freeze(Array.prototype);
Object.freeze(globalThis);

const { stripComments } = await import("./lib.js");

const debug = debuglog("strip-comments-js");
let code = 0;

debug("parsing CLI flags");
let files, options;
try {
	const { positionals, values } = parseArgs({
		args: argv[0].endsWith("node") ? argv.slice(2) : argv.slice(1),
		options: {
			help: { type: "boolean" },
			"keep-block": { type: "boolean" },
			"keep-jsdoc": { type: "boolean" },
			"keep-line": { type: "boolean" },
			"keep-protected": { type: "boolean" },
			"keep-sourcemap": { type: "boolean" },
			pattern: { type: "string" },
			"strip-license-header": { type: "boolean" },
			"strip-spdx": { type: "boolean" },
			version: { type: "boolean" },
		},

		strict: true,
		allowPositionals: true,
		allowNegative: false,
		tokens: false,
	});

	files = positionals;
	options = {
		block: !values["keep-block"],
		error: true,
		help: values.help,
		jsdoc: !values["keep-jsdoc"],
		licenseHeader: values["strip-license-header"],
		line: !values["keep-line"],
		pattern: new RegExp(values.pattern),
		protect: !values["keep-protected"],
		sourcemap: !values["keep-sourcemap"],
		spdx: values["strip-spdx"],
		version: values.version,
	};
} catch (error) {
	stderr.write(error.message + "\n");
	exit(1);
}
debug("finished parsing CLI flags, got", options);

if (options.help) {
	console.log(`strip-comments-js [flag...] [file...]

Summary:
  Strip comments from JavaScript and TypeScript code.

Flags:
  --help                   Output this help message.
  --keep-block             Don't strip block comments.
  --keep-jsdoc             Don't strip JSDoc comments.
  --keep-line              Don't strip line comments.
  --keep-protected         Don't strip protected comments.
  --keep-sourcemap         Don't strip sourcemap comments.
  --pattern <pattern>      A regular expression of comments to strip.
  --strip-license-header   Do strip license headers.
  --strip-spdx             Do strip SPDX short-form identifiers.
  --version                Output version information.

Need more help? Found a bug? Missing something? See:
https://github.com/ericcornelissen/strip-comments-js`);
	exit(0);
}

if (options.version) {
	const manifest = await import("./package.json", { with: { type: "json" } });
	console.log(`strip-comments-js : v${manifest.default.version}`);
	console.log(`Node.js           : v${versions.node}`);
	exit(0);
}

debug("received %d file(s) to strip", files.length);
const promises = files.map(async (file) => {
	debug("reading '%s'", file);
	let content;
	try {
		content = await readFile(file, { encoding: "utf-8" });
	} catch (error) {
		code = 1;
		stderr.write(error.message + "\n");
		return;
	}

	debug("stripping comments from '%s' (length: %d)", file, content.length);
	let stripped;
	try {
		stripped = stripComments(content, options);
	} catch (error) {
		code = 1;
		stderr.write(file + ": " + error.message + "\n");
		return;
	}

	if (content.length !== stripped.length) {
		debug("writing stripped file '%s' (length: %d)", file, stripped.length);
		await writeFile(file, stripped, { encoding: "utf-8" });
	} else {
		debug("not writing '%s', identical after stripping", file);
	}
});

await Promise.all(promises);
debug("finished stripping");
exit(code);
