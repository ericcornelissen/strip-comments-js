// SPDX-License-Identifier: Apache-2.0

import * as console from "node:console";
import { argv, exit } from "node:process";

delete Object.prototype.__proto__;
Object.freeze(Object.prototype);
Object.freeze(Array.prototype);
Object.freeze(globalThis);

const { stripFiles } = await import("./lib.js");
try {
	const files = argv.slice(2);
	await stripFiles(files);
	exit(0);
} catch (error) {
	console.error(error);
	exit(1);
}
