#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0

import { readFile, writeFile } from "node:fs/promises";
import { argv, exit, stderr } from "node:process";
import { debuglog } from "node:util";

delete Object.prototype.__proto__;
Object.freeze(Object.prototype);
Object.freeze(Array.prototype);
Object.freeze(globalThis);

const { stripComments } = await import("./lib.js");

const debug = debuglog("strip-comments-js");
const files = argv[0].endsWith("node") ? argv.slice(2) : argv.slice(1);
let code = 0;

debug("parsing CLI flags");
let idx = files.indexOf("--help");
const help = idx === -1 ? false : !!files.splice(idx, 1);

idx = files.indexOf("--keep-block");
const block = idx === -1 ? undefined : !files.splice(idx, 1);

idx = files.indexOf("--keep-jsdoc");
const jsdoc = idx === -1 ? undefined : !files.splice(idx, 1);

idx = files.indexOf("--keep-line");
const line = idx === -1 ? undefined : !files.splice(idx, 1);

idx = files.indexOf("--keep-protected");
const protect = idx === -1 ? undefined : !files.splice(idx, 1);

idx = files.indexOf("--strip-spdx");
const spdx = idx === -1 ? undefined : !!files.splice(idx, 1);

idx = files.indexOf("--pattern");
const pattern = idx === -1 ? undefined : new RegExp(files.splice(idx, 2)[1]);

const options = { block, help, jsdoc, line, pattern, protected: protect, spdx };
debug("finished parsing CLI flags, got", options);

if (help) {
	console.log(`strip-comments-js [flags...] [files...]

Summary:
  Strip comments from JavaScript and TypeScript code.

Flags:
  --help                Output this help message.
  --keep-block          Don't strip block comments.
  --keep-jsdoc          Don't strip JSDoc comments.
  --keep-line           Don't strip line comments.
  --keep-protected      Don't strip protected comments.
  --pattern <pattern>   A regular expression of comments to strip.
  --strip-spdx          Do strip SPDX short-form identifiers.

Need more help? Found a bug? Missing something? See:
https://gitlab.com/ericcornelissen/strip-comments-js`);
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
	const stripped = stripComments(content, options);

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
