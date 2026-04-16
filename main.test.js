// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";

import * as fc from "fast-check";

import * as arb from "./arbitraries.js";

import { strip } from "./main.js";

test("examples", async () => {
	const testdata = {};
	for (const file of await fs.readdir("testdata")) {
		if (!file.endsWith(".js")) continue;
		testdata[file] = path.resolve("testdata", file);
	}

	for (const [file, filepath] of Object.entries(testdata)) {
		const wantpath = filepath.replace(".js", ".want");
		await test(file, async () => {
			const inp = await fs.readFile(filepath, { encoding: "utf-8" });
			const got = strip(inp);
			const want = await fs.readFile(wantpath, { encoding: "utf-8" });

			assert.equal(got, want);
		});
	}
});

test("eslint", () => {
	fc.assert(
		fc.property(
			fc.record({
				pre: arb.javascript.program().map((s) => s.trimEnd()),
				directive: arb.directive.eslint(),
				post: arb.javascript.program().map((s) => s.trimStart()),
			}),
			({ pre, directive, post }) => {
				const code = `${pre}${directive}${post}`;
				return strip(code).length < code.length;
			},
		),
	);
});

test("type-coverage", () => {
	fc.assert(
		fc.property(
			fc.record({
				pre: arb.javascript.program().map((s) => s.trimEnd()),
				directive: arb.directive.typeCoverage(),
				post: arb.javascript.program().map((s) => s.trimStart()),
			}),
			({ pre, directive, post }) => {
				const code = `${pre}${directive}${post}`;
				return strip(code).length < code.length;
			},
		),
	);
});
