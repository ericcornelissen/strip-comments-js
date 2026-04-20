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

test("newlines", async () => {
	const testdata = {
		"LF after line comment": ["var x;// foo\nvar y;", "var x;\nvar y;"],
		"LF before line comment": ["var x;\n// foo", "var x;"],
		"LF after block comment": ["var x;/*foo*/\nvar y;", "var x;\nvar y;"],
		"LF before block comment": ["var x;\n/*foo*/", "var x;"],
		"CRLF after line comment": ["var x;// foo\r\nvar y;", "var x;\r\nvar y;"],
		"CRLF before line comment": ["var x;\r\n// foo", "var x;"],
		"CRLF after block comment": ["var x;/*foo*/\r\nvar y;", "var x;\r\nvar y;"],
		"CRLF before block comment": ["var x;\r\n/*foo*/", "var x;"],
		"line comment without final newline": ["var x; // foo", "var x;"],
		"block comment without final newline": ["var x; /* foo */", "var x;"],
	};

	for (const [name, [inp, want]] of Object.entries(testdata)) {
		await test(name, () => {
			assert.equal(strip(inp), want);
		});
	}
});

test("pattern", async () => {
	const testdata = {
		"pattern does match line comment": {
			pattern: /foo.+/,
			inp: "var x = y; // foobar\n",
			want: "var x = y;\n",
		},
		"pattern does match block comment": {
			pattern: /foo.+/,
			inp: "var x = /* foobar */ y;",
			want: "var x = y;",
		},
		"pattern doesn't match line comment": {
			pattern: /foobar/,
			inp: "var x = y; // foobaz",
			want: "var x = y; // foobaz",
		},
		"pattern doesn't match block comment": {
			pattern: /foobar/,
			inp: "var x = /* foobaz */ y;",
			want: "var x = /* foobaz */ y;",
		},
	};

	for (const [name, testCase] of Object.entries(testdata)) {
		await test(name, () => {
			assert.equal(strip(testCase.inp, testCase.pattern), testCase.want);
		});
	}

	await test("no pattern", () => {
		assert.doesNotThrow(() => strip("this is fine"));
	});

	await test("not a regexp", () => {
		const cases = [true, 42, 3.14, 9001n, "string", [], {}];
		for (const v of cases) {
			assert.throws(() => strip("this is not fine", v));
		}
	});
});

test("idempotent", () => {
	fc.assert(
		fc.property(
			fc.record({
				pre: arb.javascript.program().map((s) => s.trimEnd()),
				comment: arb.comment.any(),
				post: arb.javascript.program().map((s) => s.trimStart()),
			}),
			({ pre, comment, post }) => {
				const code = `${pre}${comment}${post}`;
				const stripped = strip(code);
				assert.equal(stripped, strip(stripped));
			},
		),
	);
});

test("input-output length", () => {
	fc.assert(
		fc.property(
			fc.record({
				pre: arb.javascript.program().map((s) => s.trimEnd()),
				comment: arb.comment.any(),
				post: arb.javascript.program().map((s) => s.trimStart()),
			}),
			({ pre, comment, post }) => {
				const code = `${pre}${comment}${post}`;
				assert.ok(strip(code).length < code.length, code);
			},
		),
	);
});
