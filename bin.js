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
const idx = files.indexOf("--pattern");
const pattern = idx === -1 ? undefined : new RegExp(files.splice(idx, 2)[1]);

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
	const stripped = stripComments(content, pattern);

	if (content !== stripped) {
		debug("writing stripped file '%s' (length: %d)", file, stripped.length);
		await writeFile(file, stripped, { encoding: "utf-8" });
	} else {
		debug("not writing '%s', identical after stripping", file);
	}
});

await Promise.all(promises);
debug("finished stripping");
exit(code);
