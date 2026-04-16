#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0

import * as console from "node:console";
import { argv, exit } from "node:process";
import { debuglog } from "node:util";

delete Object.prototype.__proto__;
Object.freeze(Object.prototype);
Object.freeze(Array.prototype);
Object.freeze(globalThis);

const { stripFilesDirectives } = await import("./lib.js");
try {
	const debug = debuglog("strip-directives");
	const files = argv[0].endsWith("node") ? argv.slice(2) : argv.slice(1);
	await stripFilesDirectives(files, debug);
	exit(0);
} catch (error) {
	console.error(error);
	exit(1);
}
