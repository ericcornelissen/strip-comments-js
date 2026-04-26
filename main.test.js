// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";

import * as fc from "fast-check";

import * as arb from "./arbitraries.js";

import { strip } from "./main.js";

test("testdata", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
	};

	const testdata = {};
	for (const file of await fs.readdir("testdata")) {
		if (file.endsWith(".want")) continue;
		testdata[file] = path.resolve("testdata", file);
	}

	for (const [file, filepath] of Object.entries(testdata)) {
		const wantpath = filepath.replace(/\.[a-z]+$/, ".want");
		await test(file, async () => {
			const inp = await fs.readFile(filepath, { encoding: "utf-8" });
			const got = strip(inp, options);
			const want = await fs.readFile(wantpath, { encoding: "utf-8" });

			assert.equal(got, want);
		});
	}
});

test("newlines", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
	};

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
			assert.equal(strip(inp, options), want);
		});
	}
});

test("pattern", async () => {
	const defaultOptions = {
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
	};

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
			const options = {
				...defaultOptions,
				pattern: testCase.pattern,
			};

			assert.equal(strip(testCase.inp, options), testCase.want);
		});
	}

	await test("not a regexp", () => {
		const cases = [true, 42, 3.14, 9001n, "string", [], {}];
		for (const v of cases) {
			const options = {
				...defaultOptions,
				pattern: v,
			};

			assert.throws(() => strip("this is not fine", options));
		}
	});
});

test("pathological input", () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
	};

	const testCases = [
		["//", ""],
		["// ", ""],
		["//\n", "\n"],
		["/**/", ""],
		["/* */", ""],
		["/*/**/", ""],
		["/*/*/", ""],
	];

	for (const [inp, out] of testCases) {
		assert.equal(strip(inp, options), out);
	}
});

test("preserve block comments", async () => {
	const options = {
		pattern: /[^]?/,
		block: false,
		jsdoc: true,
		line: true,
		protected: true,
	};

	await test("any block comment", () => {
		fc.assert(
			fc.property(
				fc.record({
					pre: arb.javascript.program().map((s) => s.trimEnd()),
					comment: arb.comment.block(),
					post: arb.javascript.program().map((s) => s.trimStart()),
				}),
				({ pre, comment, post }) => {
					const code = `${pre}${comment}${post}`;
					assert.equal(strip(code, options), code);
				},
			),
		);
	});

	await test("any line comment", () => {
		fc.assert(
			fc.property(
				fc.record({
					pre: arb.javascript.program().map((s) => s.trimEnd()),
					comment: arb.comment.line(),
					post: arb.javascript.program().map((s) => s.trimStart()),
				}),
				({ pre, comment, post }) => {
					const code = `${pre}${comment}${post}`;
					assert.notEqual(strip(code, options), code);
				},
			),
		);
	});

	await test("pathological input", () => {
		const code = `/* // foobar */`;
		assert.equal(strip(code, options), code);
	});
});

test("preserve JSDoc comments", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: false,
		line: true,
		protected: true,
	};

	await test("any JSDoc comment", () => {
		fc.assert(
			fc.property(
				fc.record({
					pre: arb.javascript.program().map((s) => s.trimEnd()),
					comment: arb.comment
						.block()
						.map((s) => s.replace(/^(\s*)\/\*/, "$1/**")),
					post: arb.javascript.program().map((s) => s.trimStart()),
				}),
				({ pre, comment, post }) => {
					const code = `${pre}${comment}${post}`;
					assert.equal(strip(code, options), code);
				},
			),
		);
	});

	await test("any (non-JSDoc) block comment", () => {
		fc.assert(
			fc.property(
				fc.record({
					pre: arb.javascript.program().map((s) => s.trimEnd()),
					comment: arb.comment.block().filter((s) => !/\s*\/\*\*/.test(s)),
					post: arb.javascript.program().map((s) => s.trimStart()),
				}),
				({ pre, comment, post }) => {
					const code = `${pre}${comment}${post}`;
					assert.notEqual(strip(code, options), code);
				},
			),
		);
	});

	await test("any line comment", () => {
		fc.assert(
			fc.property(
				fc.record({
					pre: arb.javascript.program().map((s) => s.trimEnd()),
					comment: arb.comment.line(),
					post: arb.javascript.program().map((s) => s.trimStart()),
				}),
				({ pre, comment, post }) => {
					const code = `${pre}${comment}${post}`;
					assert.notEqual(strip(code, options), code);
				},
			),
		);
	});

	await test("pathological input", () => {
		const code = `/** // foobar */`;
		assert.equal(strip(code, options), code);
	});
});

test("preserve line comments", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: false,
		protected: true,
	};

	await test("any line comment", () => {
		fc.assert(
			fc.property(
				fc.record({
					pre: arb.javascript.program().map((s) => s.trimEnd()),
					comment: arb.comment.line(),
					post: arb.javascript.program().map((s) => s.trimStart()),
				}),
				({ pre, comment, post }) => {
					const code = `${pre}${comment}${post}`;
					assert.equal(strip(code, options), code);
				},
			),
		);
	});

	await test("any block comment", () => {
		fc.assert(
			fc.property(
				fc.record({
					pre: arb.javascript.program().map((s) => s.trimEnd()),
					comment: arb.comment.block(),
					post: arb.javascript.program().map((s) => s.trimStart()),
				}),
				({ pre, comment, post }) => {
					const code = `${pre}${comment}${post}`;
					assert.notEqual(strip(code, options), code);
				},
			),
		);
	});

	await test("pathological input", () => {
		const code = `// /* foobar */`;
		assert.equal(strip(code, options), code);
	});
});

test("preserve protected comments", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: false,
	};

	await test("any protected comment", () => {
		fc.assert(
			fc.property(
				fc.record({
					pre: arb.javascript.program().map((s) => s.trimEnd()),
					comment: arb.comment
						.any()
						.map((s) => s.replace(/^(\s*)(\/[/*])/, "$1$2!")),
					post: arb.javascript.program().map((s) => s.trimStart()),
				}),
				({ pre, comment, post }) => {
					const code = `${pre}${comment}${post}`;
					assert.equal(strip(code, options), code);
				},
			),
		);
	});

	await test("any non-protected comment", () => {
		fc.assert(
			fc.property(
				fc.record({
					pre: arb.javascript.program().map((s) => s.trimEnd()),
					comment: arb.comment.any().filter((s) => !/\s*\/[/*]!/.test(s)),
					post: arb.javascript.program().map((s) => s.trimStart()),
				}),
				({ pre, comment, post }) => {
					const code = `${pre}${comment}${post}`;
					assert.notEqual(strip(code, options), code);
				},
			),
		);
	});
});

test("input-output length", () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
	};

	fc.assert(
		fc.property(
			fc.record({
				pre: arb.javascript.program().map((s) => s.trimEnd()),
				comment: arb.comment.any(),
				post: arb.javascript.program().map((s) => s.trimStart()),
			}),
			({ pre, comment, post }) => {
				const code = `${pre}${comment}${post}`;
				assert.ok(strip(code, options).length < code.length);
			},
		),
	);
});

test("idempotent", () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
	};

	fc.assert(
		fc.property(
			fc.record({
				pre: arb.javascript.program().map((s) => s.trimEnd()),
				comment: arb.comment.any(),
				post: arb.javascript.program().map((s) => s.trimStart()),
			}),
			({ pre, comment, post }) => {
				const code = `${pre}${comment}${post}`;
				const got = strip(code, options);
				const want = strip(got, options);
				assert.equal(got, want);
			},
		),
	);
});
