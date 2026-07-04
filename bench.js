// SPDX-License-Identifier: Apache-2.0

import { readFile } from "node:fs/promises";

import { Bench } from "tinybench";

import { strip, strip2 } from "./main.js";

const program = readFile("./main.js");
const options = {
	pattern: /[^]?/,
	block: true,
	jsdoc: true,
	line: true,
	protected: true,
	spdx: false,
};

const bench = new Bench();
bench
	.add("old", () => {
		strip(program, options);
	})
	.add("new", () => {
		strip2(program, options);
	});

await bench.run();
console.table(bench.table());
