// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert/strict";
import { env } from "node:process";
import { suite, test } from "node:test";

import * as acorn from "acorn";
import * as fc from "fast-check";

import * as arb from "./arbitraries.js";
import * as testdata from "./testdata.js";

import { strip } from "./main.js";

if (env.MUTATION_TESTING) {
	fc.configureGlobal({ numRuns: 0 });
}

const baseOptions = Object.freeze({
	atlicense: true,
	block: true,
	jsdoc: true,
	licenseHeader: true,
	line: true,
	pattern: /[^]?/,
	protected: true,
	sourcemap: true,
	spdx: true,
});

suite("testdata", async () => {
	for (using testcase of await testdata.files()) {
		test(testcase.name, () => {
			const options = {
				...baseOptions,
				...testcase.options,
			};

			const got = strip(testcase.original, options);
			assert.equal(got, testcase.want);
		});
	}
});

suite("pattern", () => {
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
		"pattern with start of string anchor, line comment": {
			pattern: /^\s*foo/,
			inp: "var x = y; // foobar\n",
			want: "var x = y;\n",
		},
		"pattern with start of string anchor, block comment": {
			pattern: /^\s*foo/,
			inp: "var x = y; /* foobar */\n",
			want: "var x = y;\n",
		},
		"pattern with end of string anchor, line comment": {
			pattern: /bar\s*$/,
			inp: "var x = y; // foobar\n",
			want: "var x = y;\n",
		},
		"pattern with end of string anchor, block comment": {
			pattern: /hello world!\s*$/,
			inp: "var x = y; /* hello world! */\n",
			want: "var x = y;\n",
		},
		"pattern with end of string anchor, line comment ending in CRLF": {
			pattern: /bar$/,
			inp: "var x = y; // foobar\r\n",
			want: "var x = y;\r\n",
		},
		"multiline block comment without leading '*'": {
			pattern: /hello world/,
			inp: "/*\nhello\nworld\n*/var x = 'Hello world!'",
			want: "var x = 'Hello world!'",
		},
		"multiline block comment without leading '*', indented": {
			pattern: /hello world/,
			inp: "\t/*\t\nhello\t\nworld\t\n*/var x = 'Hello world!'",
			want: "var x = 'Hello world!'",
		},
		"multiline block comment with leading '*'": {
			pattern: /hello world/,
			inp: "/*\n * hello\n * world\n */var x = 'Hello world!'",
			want: "var x = 'Hello world!'",
		},
		"multiline block comment with leading '*', indented": {
			pattern: /hello world/,
			inp: "\t/*\n\t * hello\n\t * world\n\t */var x = 'Hello world!'",
			want: "var x = 'Hello world!'",
		},
		"multiline JSDoc comment": {
			pattern: /hello world/,
			inp: "/**\n * hello\n * world\n */var x = 'Hello world!'",
			want: "var x = 'Hello world!'",
		},
		"multiline JSDoc comment, indented": {
			pattern: /hello world/,
			inp: "\t/**\n\t * hello\n\t * world\n\t */var x = 'Hello world!'",
			want: "var x = 'Hello world!'",
		},
		"multiline block comment starting on line 1": {
			pattern: /^goodbye cruel world$/,
			inp: "/* goodbye\n   cruel\n   world\n*/var x = 'Hello world!'",
			want: "var x = 'Hello world!'",
		},
		"multiline block comment with leading newlines": {
			pattern: /^foo$/,
			inp: "/*\n\n\nfoo */var bar = 'baz';",
			want: "var bar = 'baz';",
		},
		"multiline block comment with trailing newlines": {
			pattern: /^foo$/,
			inp: "/* foo\n\n\n*/var bar = 'baz';",
			want: "var bar = 'baz';",
		},
		"multiline line comment": {
			pattern: /hello world/,
			inp: "{\n  // hello\n  // world\n  var x = 'Hello world!';\n}",
			want: "{\n  var x = 'Hello world!';\n}",
		},
		"multiline line comment, CRLF": {
			pattern: /hello world/,
			inp: "{\n  // hello\r\n  //  world\n  1/2\n}",
			want: "{\n  1/2\n}",
		},
		"multiline line comment, CR mid-comment": {
			pattern: /hello wor?ld/,
			inp: "{\n  // hello\n  // wo\rld\n  1/2\n}",
			want: "{\n  // hello\n  // wo\rld\n  1/2\n}",
		},
		"protected comment, block": {
			pattern: /^\s*hello world!\s*$/,
			inp: "/*! hello world! */",
			want: "",
		},
		"protected comment, line": {
			pattern: /^\s*hello world!\s*$/,
			inp: "//! hello world!",
			want: "",
		},
		"multiline protected line comment": {
			pattern: /hello world/,
			inp: "{\n  //! hello\n  //! world\n  var x = 'Hello world!';\n}",
			want: "{\n  var x = 'Hello world!';\n}",
		},
		"multiline protected line comment, CRLF": {
			pattern: /hello world$/,
			inp: "{\n  //! hello\r\n  //! world\n  var x = 'Hello world!';\n}",
			want: "{\n  var x = 'Hello world!';\n}",
		},
	};

	for (const [name, testcase] of Object.entries(testdata)) {
		test(name, () => {
			const options = {
				...baseOptions,
				pattern: testcase.pattern,
			};

			assert.equal(strip(testcase.inp, options), testcase.want);
		});
	}

	suite("not a regexp", () => {
		const testdata = {
			boolean: true,
			integer: 42,
			float: 3.14,
			bigint: 9001n,
			string: "string",
			array: [],
			object: {},
			symbol: Symbol(),
		};

		for (const [name, pattern] of Object.entries(testdata)) {
			test(name, () => {
				const options = {
					...baseOptions,
					pattern,
				};

				assert.throws(
					() => {
						strip("this is not fine", options);
					},
					{ name: "TypeError", message: "pattern must be a RegExp" },
				);
			});
		}
	});
});

suite("preserve block comments", () => {
	const options = {
		...baseOptions,
		block: false,
	};

	const testdata = {
		"block comment": [`/* foobar */`, `/* foobar */`],
		"block comment, empty": [`/**/`, `/**/`],
		"block comment, multiline": [`/* foo \n bar */`, `/* foo \n bar */`],
		"block comment, two in a row": [`/* foo *//* bar */`, `/* foo *//* bar */`],
		"block comment containing a license header, line": [
			`/* // Copyright (C) 2026  Henk */`,
			`/* // Copyright (C) 2026  Henk */`,
		],
		"block comment containing a line comment": [
			`/* // foobar */`,
			`/* // foobar */`,
		],
		"block comment containing a protected comment, line": [
			`/* //! foobar */`,
			`/* //! foobar */`,
		],
		"block comment containing a sourcemap comment": [
			`/* //# sourceMappingURL=foobar.js.map */`,
			`/* //# sourceMappingURL=foobar.js.map */`,
		],
		"block comment containing a spdx identifier": [
			`/* // SPDX-License-Identifier: Apache-2.0 */`,
			`/* // SPDX-License-Identifier: Apache-2.0 */`,
		],
		"block comment followed by a jsdoc comment": [
			`/* foo *//** bar */`,
			`/* foo */`,
		],
		"block comment followed by a license header, block": [
			`/* foo *//* Copyright (C) 2026  Henk */`,
			`/* foo */`,
		],
		"block comment followed by a license header, line": [
			`/* foo */// Copyright (C) 2026  Henk`,
			`/* foo */`,
		],
		"block comment followed by a line comment": [
			`/* foo */// bar`,
			`/* foo */`,
		],
		"block comment followed by a protected comment, block": [
			`/* foo *//*! bar */`,
			`/* foo *//*! bar */`,
		],
		"block comment followed by a protected comment, line": [
			`/* foo *///! bar`,
			`/* foo */`,
		],
		"block comment followed by a sourcemap comment": [
			`/* foo *///# sourceMappingURL=bar.js.map`,
			`/* foo */`,
		],
		"block comment followed by a spdx identifier": [
			`/* foo */// SPDX-License-Identifier: Apache-2.0`,
			`/* foo */`,
		],
		"block comment lead by a jsdoc comment": [
			`/** foo *//* bar */`,
			`/* bar */`,
		],
		"block comment lead by a license header, block": [
			`/* Copyright (C) 2026  Henk *//* bar */`,
			`/* bar */`,
		],
		"block comment lead by a license header, line": [
			`// Copyright (C) 2026  Henk\n/* bar */`,
			`/* bar */`,
		],
		"block comment lead by a line comment": [`// foo\n/* bar */`, `/* bar */`],
		"block comment lead by a protected comment, block": [
			`/*! foo *//* bar */`,
			`/*! foo *//* bar */`,
		],
		"block comment lead by a protected comment, line": [
			`//! foo\n/* bar */`,
			`/* bar */`,
		],
		"block comment lead by a sourcemap comment": [
			`//# sourceMappingURL=foo.js.map\n/* bar */`,
			`/* bar */`,
		],
		"block comment lead by a spdx identifier": [
			`// SPDX-License-Identifier: Apache-2.0\n/* bar */`,
			`/* bar */`,
		],
		"jsdoc comment": [`/** foobar */`, ``],
		"jsdoc license comment": [`/** @license Apache-2.0 */`, ``],
		"license header, block": [`/* Copyright (C) 2026  Henk */`, ``],
		"license header, block protected": [`/*! Copyright (C) 2026  Henk */`, ``],
		"license header, line": [`// Copyright (C) 2026  Henk`, ``],
		"license header, line protected": [`//! Copyright (C) 2026  Henk`, ``],
		"line comment": [`// foobar`, ``],
		"protected comment, block": [`/*! foobar */`, `/*! foobar */`],
		"protected comment, line": [`//! foobar`, ``],
		"sourcemap comment": [`//# sourceMappingURL=foobar.js.map`, ``],
		"spdx identifier": [`// SPDX-License-Identifier: Apache-2.0`, ``],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	test("any block comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("block"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	test("any line comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("line"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

suite("preserve JSDoc comments", () => {
	const options = {
		...baseOptions,
		jsdoc: false,
	};

	const testdata = {
		"block comment": [`/* foobar */`, ``],
		"jsdoc comment": [`/** foobar */`, `/** foobar */`],
		"jsdoc comment, empty": [`/***/`, `/***/`],
		"jsdoc comment, multiline": [`/**\n * foobar\n */`, `/**\n * foobar\n */`],
		"jsdoc comment, two in a row": [
			`/** foo *//** bar */`,
			`/** foo *//** bar */`,
		],
		"jsdoc comment containing a license header, line": [
			`/** // Copyright (C) 2026  Henk */`,
			`/** // Copyright (C) 2026  Henk */`,
		],
		"jsdoc comment containing a line comment": [
			`/** // foobar */`,
			`/** // foobar */`,
		],
		"jsdoc comment containing a protected comment, line": [
			`/** //! foobar */`,
			`/** //! foobar */`,
		],
		"jsdoc comment containing a sourcemap comment": [
			`/** //# sourceMappingURL=foobar.js.map */`,
			`/** //# sourceMappingURL=foobar.js.map */`,
		],
		"jsdoc comment containing a spdx identifier": [
			`/** // SPDX-License-Identifier: Apache-2.0 */`,
			`/** // SPDX-License-Identifier: Apache-2.0 */`,
		],
		"jsdoc comment followed by a block comment": [
			`/** foo *//* bar */`,
			`/** foo */`,
		],
		"jsdoc comment followed by a license header, block": [
			`/** foo *//* Copyright (C) 2026  Henk */`,
			`/** foo */`,
		],
		"jsdoc comment followed by a license header, line": [
			`/** foo */// Copyright (C) 2026  Henk`,
			`/** foo */`,
		],
		"jsdoc comment followed by a line comment": [
			`/** foo */// bar`,
			`/** foo */`,
		],
		"jsdoc comment followed by a protected comment, block": [
			`/** foo *//*! bar */`,
			`/** foo */`,
		],
		"jsdoc comment followed by a protected comment, line": [
			`/** foo *///! bar`,
			`/** foo */`,
		],
		"jsdoc comment followed by a sourcemap comment": [
			`/** foo *///# sourceMappingURL=bar.js.map`,
			`/** foo */`,
		],
		"jsdoc comment followed by a spdx identifier": [
			`/** foo */// SPDX-License-Identifier: Apache-2.0`,
			`/** foo */`,
		],
		"jsdoc comment lead by a block comment": [
			`/* foo *//** bar */`,
			`/** bar */`,
		],
		"jsdoc comment lead by a license header, block": [
			`/* Copyright (C) 2026  Henk *//** bar */`,
			`/** bar */`,
		],
		"jsdoc comment lead by a license header, line": [
			`// Copyright (C) 2026  Henk\n/** bar */`,
			`/** bar */`,
		],
		"jsdoc comment lead by a line comment": [
			`// foo\n/** bar */`,
			`/** bar */`,
		],
		"jsdoc comment lead by a protected comment, block": [
			`/*! foo *//** bar */`,
			`/** bar */`,
		],
		"jsdoc comment lead by a protected comment, line": [
			`//! foo\n/** bar */`,
			`/** bar */`,
		],
		"jsdoc comment lead by a sourcemap comment": [
			`//# sourceMappingURL=foo.js.map\n/** bar */`,
			`/** bar */`,
		],
		"jsdoc comment lead by a spdx identifier": [
			`// SPDX-License-Identifier: Apache-2.0\n/** bar */`,
			`/** bar */`,
		],
		"jsdoc license comment": [`/** @license Apache-2.0 */`, ``],
		"license header, block": [`/* Copyright (C) 2026  Henk */`, ``],
		"license header, block protected": [`/*! Copyright (C) 2026  Henk */`, ``],
		"license header, line": [`// Copyright (C) 2026  Henk`, ``],
		"license header, line protected": [`//! Copyright (C) 2026  Henk`, ``],
		"line comment": [`// foobar`, ``],
		"protected comment, block": [`/*! foobar */`, ``],
		"protected comment, line": [`//! foobar`, ``],
		"sourcemap comment": [`//# sourceMappingURL=foobar.js.map`, ``],
		"spdx identifier": [`// SPDX-License-Identifier: Apache-2.0`, ``],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	test("any JSDoc comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("jsdoc"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	test("any (non-JSDoc) block comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("non-jsdoc"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});

	test("any line comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("line"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

suite("preserve JSDoc license comments", () => {
	const options = {
		...baseOptions,
		atlicense: false,
	};

	const testdata = {
		"block comment": [`/* @license Apache-2.0 */`, ``],
		"jsdoc comment, without @license": [`/** @module foo/bar */`, ``],
		"jsdoc comment, with @license": [
			`/** @license Apache-2.0 */`,
			`/** @license Apache-2.0 */`,
		],
		"jsdoc comment, with @license, extra whitespace": [
			`/** @license  Apache-2.0 */`,
			`/** @license  Apache-2.0 */`,
		],
		"jsdoc comment, with @license, tight": [
			`/**@license Apache-2.0*/`,
			`/**@license Apache-2.0*/`,
		],
		"jsdoc comment, with @license, newline": [
			`/**\n * @license Apache-2.0\n */`,
			`/**\n * @license Apache-2.0\n */`,
		],
		"jsdoc comment, with @license, newline tight": [
			`/**\n *@license Apache-2.0*/`,
			`/**\n *@license Apache-2.0*/`,
		],
		"jsdoc comment, with @license, not quite": [
			`/** @licenseApache-2.0 */`,
			``,
		],
		"line comment": [`// @license Apache-2.0`, ``],
		"protected comment, block": [`/*! @license Apache-2.0 */`, ``],
		"protected comment, line": [`//! @license Apache-2.0`, ``],
		"@license comment in line comment": [`// /** @license MIT */`, ``],
		"@license comment in protected comment": [`//! /** @license MIT */`, ``],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}
});

suite("preserve license header comments", () => {
	const options = {
		...baseOptions,
		licenseHeader: false,
	};

	const testdata = {
		"block comment": [`/* foobar */`, ``],
		"jsdoc comment": [`/** foobar */`, ``],
		"jsdoc license comment": [`/** @license Apache-2.0 */`, ``],
		"license block header": [
			`/* Copyright (C) 2025  Kip */`,
			`/* Copyright (C) 2025  Kip */`,
		],
		"license block header, multiline": [
			`/* Copyright (C) 2025  Kip\n *\n * This program is free software: ...*/`,
			`/* Copyright (C) 2025  Kip\n *\n * This program is free software: ...*/`,
		],
		"license block header protected": [
			`/*! Copyright (C) 2025  Kip */`,
			`/*! Copyright (C) 2025  Kip */`,
		],
		"license block header, multiline protected": [
			`/*! Copyright (C) 2025  Kip\n *\n * This program is free software: ...*/`,
			`/*! Copyright (C) 2025  Kip\n *\n * This program is free software: ...*/`,
		],
		"license block header, not quite, prefix": [
			`/* xCopyright (C) 2025-2026 */`,
			``,
		],
		"license block header, not quite, suffix": [
			`/* Copyright (C) 2025-2026x */`,
			``,
		],
		"license block header, two in a row": [
			`/* Copyright (C) 2025  Kip *//* Copyright (C) 2026  Henk */`,
			`/* Copyright (C) 2025  Kip *//* Copyright (C) 2026  Henk */`,
		],
		"license block header, protected not-protected": [
			`/*! Copyright (C) 2025  Kip *//* Copyright (C) 2026  Henk */`,
			`/*! Copyright (C) 2025  Kip *//* Copyright (C) 2026  Henk */`,
		],
		"license block header, not-protected protected": [
			`/* Copyright (C) 2025  Kip *//*! Copyright (C) 2026  Henk */`,
			`/* Copyright (C) 2025  Kip *//*! Copyright (C) 2026  Henk */`,
		],
		"license block header, year range": [
			`/* Copyright (C) 2025-2026  John */`,
			`/* Copyright (C) 2025-2026  John */`,
		],
		"license block header followed by a block comment": [
			`/* Copyright (C) 2025  Kip *//* bar */`,
			`/* Copyright (C) 2025  Kip */`,
		],
		"license block header followed by a jsdoc comment": [
			`/* Copyright (C) 2025  Kip *//** bar */`,
			`/* Copyright (C) 2025  Kip */`,
		],
		"license block header followed by a license header, line": [
			`/* Copyright (C) 2025  Kip */// Copyright (C) 2026  Henk`,
			`/* Copyright (C) 2025  Kip */// Copyright (C) 2026  Henk`,
		],
		"license block header followed by a line comment": [
			`/* Copyright (C) 2025  Kip */// bar`,
			`/* Copyright (C) 2025  Kip */`,
		],
		"license block header followed by a protected comment, block": [
			`/* Copyright (C) 2025  Kip *//*! bar */`,
			`/* Copyright (C) 2025  Kip */`,
		],
		"license block header followed by a protected comment, line": [
			`/* Copyright (C) 2025  Kip *///! bar`,
			`/* Copyright (C) 2025  Kip */`,
		],
		"license block header followed by a sourcemap comment": [
			`/* Copyright (C) 2025  Kip *///# sourceMappingURL=bar.js.map`,
			`/* Copyright (C) 2025  Kip */`,
		],
		"license block header followed by a spdx identifier": [
			`/* Copyright (C) 2025  Kip */// SPDX-License-Identifier: Apache-2.0`,
			`/* Copyright (C) 2025  Kip */`,
		],
		"license block header lead by a block comment": [
			`/* foo *//* Copyright (C) 2026  Henk */`,
			`/* Copyright (C) 2026  Henk */`,
		],
		"license block header lead by a jsdoc comment": [
			`/** foo *//* Copyright (C) 2026  Henk */`,
			`/* Copyright (C) 2026  Henk */`,
		],
		"license block header lead by a license header, line": [
			`// Copyright (C) 2026  Henk\n/* Copyright (C) 2026  Henk */`,
			`// Copyright (C) 2026  Henk\n/* Copyright (C) 2026  Henk */`,
		],
		"license block header lead by a line comment": [
			`// foo\n/* Copyright (C) 2026  Henk */`,
			`/* Copyright (C) 2026  Henk */`,
		],
		"license block header lead by a protected comment, block": [
			`/*! foo *//* Copyright (C) 2026  Henk */`,
			`/* Copyright (C) 2026  Henk */`,
		],
		"license block header lead by a protected comment, line": [
			`//! foo\n/* Copyright (C) 2026  Henk */`,
			`/* Copyright (C) 2026  Henk */`,
		],
		"license block header lead by a sourcemap comment": [
			`//# sourceMappingURL=foo.js.map\n/* Copyright (C) 2026  Henk */`,
			`/* Copyright (C) 2026  Henk */`,
		],
		"license block header lead by a spdx identifier": [
			`// SPDX-License-Identifier: Apache-2.0\n/* Copyright (C) 2026  Henk */`,
			`/* Copyright (C) 2026  Henk */`,
		],
		"license line header": [
			`// Copyright (C) 2026  Henk`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header, protected": [
			`//! Copyright (C) 2026  Henk`,
			`//! Copyright (C) 2026  Henk`,
		],
		"license line header, multiline": [
			`// Copyright (C) 2026  Henk\n//\n// This program is free software: ...`,
			`// Copyright (C) 2026  Henk\n//\n// This program is free software: ...`,
		],
		"license line header, protected multiline": [
			`//! Copyright (C) 2026  Henk\n//!\n//! This program is free software: ...`,
			`//! Copyright (C) 2026  Henk\n//!\n//! This program is free software: ...`,
		],
		"license line header, no leading space": [
			`//Copyright (C) 2026  Henk`,
			`//Copyright (C) 2026  Henk`,
		],
		"license line header, extra leading spacing": [
			`//   Copyright (C) 2026  Henk`,
			`//   Copyright (C) 2026  Henk`,
		],
		"license line header, not quite, prefix": [
			`// xCopyright (C) 2025-2026`,
			``,
		],
		"license line header, not quite, suffix": [
			`// Copyright (C) 2025-2026x`,
			``,
		],
		"license line header, year range": [
			`// Copyright (C) 2025-2026  John`,
			`// Copyright (C) 2025-2026  John`,
		],
		"license line header followed by a block comment": [
			`// Copyright (C) 2026  Henk\n/* bar */`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header followed by a jsdoc comment": [
			`// Copyright (C) 2026  Henk\n/** bar */`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header followed by a license header, block": [
			`// Copyright (C) 2026  Henk\n/* Copyright (C) 2026  Henk */`,
			`// Copyright (C) 2026  Henk\n/* Copyright (C) 2026  Henk */`,
		],
		"license line header followed by a line comment": [
			`// Copyright (C) 2026  Henk\n// bar`,
			`// Copyright (C) 2026  Henk\n// bar`,
		],
		"license line header followed by a protected comment, block": [
			`// Copyright (C) 2026  Henk\n/*! bar */`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header followed by a protected comment, line": [
			`// Copyright (C) 2026  Henk\n//! bar`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header followed by a sourcemap comment": [
			`// Copyright (C) 2026  Henk\n//# sourceMappingURL=bar.js.map`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header followed by a spdx identifier": [
			`// Copyright (C) 2026  Henk\n// SPDX-License-Identifier: Apache-2.0`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header lead by a block comment": [
			`/* foo */// Copyright (C) 2026  Henk`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header lead by a jsdoc comment": [
			`/** foo */// Copyright (C) 2026  Henk`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header lead by a license header, block": [
			`/* Copyright (C) 2026  Henk */// Copyright (C) 2026  Henk`,
			`/* Copyright (C) 2026  Henk */// Copyright (C) 2026  Henk`,
		],
		"license line header lead by a line comment": [
			`// foo\n// Copyright (C) 2026  Henk`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header lead by a protected comment, block": [
			`/*! foo */// Copyright (C) 2026  Henk`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header lead by a protected comment, line": [
			`//! foo \n// Copyright (C) 2026  Henk`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header lead by a sourcemap comment": [
			`//# sourceMappingURL=foobar.js.map\n// Copyright (C) 2026  Henk`,
			`// Copyright (C) 2026  Henk`,
		],
		"license line header lead by a spdx identifier": [
			`// SPDX-License-Identifier: Apache-2.0\n// Copyright (C) 2026  Henk`,
			`// Copyright (C) 2026  Henk`,
		],
		"line comment": [`// foobar`, ``],
		"protected comment, block": [`/*! foobar */`, ``],
		"protected comment, line": [`//! foobar`, ``],
		"sourcemap comment": [`//# sourceMappingURL=foobar.js.map`, ``],
		"spdx identifier": [`// SPDX-License-Identifier: Apache-2.0`, ``],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	test("any license header", () => {
		fc.assert(
			fc.property(
				arb.codeWithComment("license header"),
				({ code, comment }) => {
					const stripped = strip(code, options);
					assert.ok(stripped.includes(comment.trim()));
				},
			),
		);
	});

	test("any non-license header comment", () => {
		fc.assert(
			fc.property(
				arb.codeWithComment("non-license header"),
				({ code, comment }) => {
					const stripped = strip(code, options);
					assert.ok(!stripped.includes(comment));
				},
			),
		);
	});
});

suite("preserve line comments", () => {
	const options = {
		...baseOptions,
		line: false,
	};

	const testdata = {
		"block comment": [`/* foobar */`, ``],
		"jsdoc comment": [`/** foobar */`, ``],
		"jsdoc license comment": [`/** @license Apache-2.0 */`, ``],
		"license header, block": [`/* Copyright (C) 2026  Henk */`, ``],
		"license header, block protected": [`/*! Copyright (C) 2026  Henk */`, ``],
		"license header, line": [`// Copyright (C) 2026  Henk`, ``],
		"license header, line protected": [`//! Copyright (C) 2026  Henk`, ``],
		"line comment": [`// foobar`, `// foobar`],
		"line comment, empty": [`//`, `//`],
		"line comment, two in a row": [`// foo\n// bar`, `// foo\n// bar`],
		"line comment containing a block comment": [`// /* a */`, `// /* a */`],
		"line comment containing a jsdoc comment": [`// /** b */`, `// /** b */`],
		"line comment containing a license header, block": [
			`// /* Copyright (C) 2026  Henk */`,
			`// /* Copyright (C) 2026  Henk */`,
		],
		"line comment containing a license header, line": [
			`// // Copyright (C) 2026  Henk`,
			`// // Copyright (C) 2026  Henk`,
		],
		"line comment containing a line comment": [`// // c`, `// // c`],
		"line comment containing a protected comment, block": [
			`// foo /*! bar */`,
			`// foo /*! bar */`,
		],
		"line comment containing a protected comment, line": [
			`// foo //! bar`,
			`// foo //! bar`,
		],
		"line comment containing a sourcemap comment": [
			`// foo //# sourceMappingURL=bar.js.map`,
			`// foo //# sourceMappingURL=bar.js.map`,
		],
		"line comment containing a spdx identifier": [
			`// // SPDX-License-Identifier: Apache-2.0`,
			`// // SPDX-License-Identifier: Apache-2.0`,
		],
		"line comment followed by a block comment": [`// foo\n/* bar */`, `// foo`],
		"line comment followed by a jsdoc comment": [`// a\n/** b */`, `// a`],
		"line comment followed by a license header, block": [
			`// foo\n/* Copyright (C) 2026  Henk */`,
			`// foo`,
		],
		"line comment followed by a license header, line": [
			`// foo\n// Copyright (C) 2026  Henk`,
			`// foo`,
		],
		"line comment followed by a protected comment, block": [
			`// foo\n/*! bar */`,
			`// foo`,
		],
		"line comment followed by a protected comment, line": [
			`// foo\n//! bar`,
			`// foo\n//! bar`,
		],
		"line comment followed by a sourcemap comment": [
			`// foo\n//# sourceMappingURL=bar.js.map`,
			`// foo`,
		],
		"line comment followed by a spdx identifier": [
			`// foo\n// SPDX-License-Identifier: Apache-2.0`,
			`// foo`,
		],
		"line comment lead by a block comment": [`/* foo */// bar`, `// bar`],
		"line comment lead by a jsdoc comment": [`/** foo */// bar`, `// bar`],
		"line comment lead by a license header, block": [
			`/* Copyright (C) 2026  Henk */// foo`,
			`// foo`,
		],
		"line comment lead by a license header, line": [
			`// Copyright (C) 2026  Henk\n// foo\n`,
			``,
		],
		"line comment lead by a protected comment, block": [
			`/*! foo */// bar`,
			`// bar`,
		],
		"line comment lead by a protected comment, line": [
			`//! foo\n// bar`,
			`//! foo\n// bar`,
		],
		"line comment lead by a sourcemap comment": [
			`//# sourceMappingURL=foobar.js.map\n// bar`,
			`// bar`,
		],
		"line comment lead by a spdx identifier": [
			`// SPDX-License-Identifier: Apache-2.0\n// bar`,
			`// bar`,
		],
		"protected comment, block": [`/*! foobar */`, ``],
		"protected comment, line": [`//! foobar`, `//! foobar`],
		"sourcemap comment": [`//# sourceMappingURL=foobar.js.map`, ``],
		"spdx identifier": [`// SPDX-License-Identifier: Apache-2.0`, ``],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	test("any line comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("line"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	test("any block comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("block"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

suite("preserve protected comments", () => {
	const options = {
		...baseOptions,
		protected: false,
	};

	const testdata = {
		"block comment": [`/* foobar */`, ``],
		"jsdoc comment": [`/** foobar */`, ``],
		"jsdoc license comment": [`/** @license Apache-2.0 */`, ``],
		"license header, block": [`/* Copyright (C) 2026  Henk */`, ``],
		"license header, block protected": [`/*! Copyright (C) 2026  Henk */`, ``],
		"license header, line": [`// Copyright (C) 2026  Henk`, ``],
		"license header, line protected": [`//! Copyright (C) 2026  Henk`, ``],
		"line comment": [`// foobar`, ``],
		"protected block comment": [`/*! foobar */`, `/*! foobar */`],
		"protected block comment, empty": [`/*!*/`, `/*!*/`],
		"protected block comment, multiline": [
			`/*!\n * foobar\n */`,
			`/*!\n * foobar\n */`,
		],
		"protected block comment, two in a row": [
			`/*! foo *//*! bar */`,
			`/*! foo *//*! bar */`,
		],
		"protected block comment containing a license header, line": [
			`/*! // Copyright (C) 2026  Henk */`,
			`/*! // Copyright (C) 2026  Henk */`,
		],
		"protected block comment containing a line comment": [
			`/*! // foobar */`,
			`/*! // foobar */`,
		],
		"protected block comment containing a protected comment, line": [
			`/*! //! foobar */`,
			`/*! //! foobar */`,
		],
		"protected block comment containing a sourcemap comment": [
			`/*! //# sourceMappingURL=foobar.js.map */`,
			`/*! //# sourceMappingURL=foobar.js.map */`,
		],
		"protected block comment containing a spdx identifier": [
			`/*! // SPDX-License-Identifier: Apache-2.0 */`,
			`/*! // SPDX-License-Identifier: Apache-2.0 */`,
		],
		"protected block comment followed by a block comment": [
			`/*! foo *//* bar */`,
			`/*! foo */`,
		],
		"protected block comment followed by a jsdoc comment": [
			`/*! foo *//** bar */`,
			`/*! foo */`,
		],
		"protected block comment followed by a license header, block": [
			`/*! foo *//* Copyright (C) 2026  Henk */`,
			`/*! foo */`,
		],
		"protected block comment followed by a license header, line": [
			`/*! foo */// Copyright (C) 2026  Henk`,
			`/*! foo */`,
		],
		"protected block comment followed by a line comment": [
			`/*! foo */// bar`,
			`/*! foo */`,
		],
		"protected block comment followed by a protected comment, line": [
			`/*! foo *///! bar`,
			`/*! foo *///! bar`,
		],
		"protected block comment followed by a sourcemap comment": [
			`/*! foo *///# sourceMappingURL=bar.js.map`,
			`/*! foo */`,
		],
		"protected block comment followed by a spdx identifier": [
			`/*! foo */// SPDX-License-Identifier: Apache-2.0`,
			`/*! foo */`,
		],
		"protected block comment lead by a block comment": [
			`/* foo *//*! bar */`,
			`/*! bar */`,
		],
		"protected block comment lead by a jsdoc comment": [
			`/** foo *//*! bar */`,
			`/*! bar */`,
		],
		"protected block comment lead by a license header, block": [
			`/* Copyright (C) 2026  Henk *//*! bar */`,
			`/*! bar */`,
		],
		"protected block comment lead by a license header, line": [
			`// Copyright (C) 2026  Henk\n/*! bar */`,
			`/*! bar */`,
		],
		"protected block comment lead by a line comment": [
			`// foo\n/*! bar */`,
			`/*! bar */`,
		],
		"protected block comment lead by a protected comment, line": [
			`//! foo\n/*! bar */`,
			`//! foo\n/*! bar */`,
		],
		"protected block comment lead by a sourcemap comment": [
			`//# sourceMappingURL=foo.js.map\n/*! bar */`,
			`/*! bar */`,
		],
		"protected block comment lead by a spdx identifier": [
			`// SPDX-License-Identifier: Apache-2.0\n/*! bar */`,
			`/*! bar */`,
		],
		"protected line comment": [`//! foobar`, `//! foobar`],
		"protected line comment, empty": [`//!`, `//!`],
		"protected line comment, two in a row": [
			`//! foo\n//! bar`,
			`//! foo\n//! bar`,
		],
		"protected line comment containing a block comment": [
			`//! /* a */`,
			`//! /* a */`,
		],
		"protected line comment containing a jsdoc comment": [
			`//! /** b */`,
			`//! /** b */`,
		],
		"protected line comment containing a license header, block": [
			`//! /* Copyright (C) 2026  Henk */`,
			`//! /* Copyright (C) 2026  Henk */`,
		],
		"protected line comment containing a license header, line": [
			`//! // Copyright (C) 2026  Henk`,
			`//! // Copyright (C) 2026  Henk`,
		],
		"protected line comment containing a line comment": [
			`//! // c`,
			`//! // c`,
		],
		"protected line comment containing a protected comment, block": [
			`//! foo /*! bar */`,
			`//! foo /*! bar */`,
		],
		"protected line comment containing a protected comment, line": [
			`//! foo //! bar`,
			`//! foo //! bar`,
		],
		"protected line comment containing a sourcemap comment": [
			`//! foo //# sourceMappingURL=bar.js.map`,
			`//! foo //# sourceMappingURL=bar.js.map`,
		],
		"protected line comment containing a spdx identifier": [
			`//! // SPDX-License-Identifier: Apache-2.0`,
			`//! // SPDX-License-Identifier: Apache-2.0`,
		],
		"protected line comment followed by a block comment": [
			`//! foo\n/* bar */`,
			`//! foo`,
		],
		"protected line comment followed by a jsdoc comment": [
			`//! foo\n/** bar */`,
			`//! foo`,
		],
		"protected line comment followed by a license header, block": [
			`//! foo\n/* Copyright (C) 2026  Henk */`,
			`//! foo`,
		],
		"protected line comment followed by a license header, line": [
			`//! foo\n// Copyright (C) 2026  Henk`,
			`//! foo`,
		],
		"protected line comment followed by a line comment": [
			`//! foo\n// bar`,
			`//! foo`,
		],
		"protected line comment followed by a protected comment, block": [
			`//! foo\n/*! bar */`,
			`//! foo\n/*! bar */`,
		],
		"protected line comment followed by a sourcemap comment": [
			`//! foo\n//# sourceMappingURL=bar.js.map`,
			`//! foo`,
		],
		"protected line comment followed by a spdx identifier": [
			`//! foo\n// SPDX-License-Identifier: Apache-2.0`,
			`//! foo`,
		],
		"protected line comment lead by a block comment": [
			`/* foo *///! bar`,
			`//! bar`,
		],
		"protected line comment lead by a jsdoc comment": [
			`/** foo *///! bar`,
			`//! bar`,
		],
		"protected line comment lead by a license header, block": [
			`/* Copyright (C) 2026  Henk *///! bar`,
			`//! bar`,
		],
		"protected line comment lead by a license header, line": [
			`// Copyright (C) 2026  Henk\n//! bar`,
			`//! bar`,
		],
		"protected line comment lead by a line comment": [
			`// foo\n//! bar`,
			`//! bar`,
		],
		"protected line comment lead by a protected comment, block": [
			`/*! foo *///! bar`,
			`/*! foo *///! bar`,
		],
		"protected line comment lead by a sourcemap comment": [
			`//# sourceMappingURL=foobar.js.map\n//! bar`,
			`//! bar`,
		],
		"protected line comment lead by a spdx identifier": [
			`// SPDX-License-Identifier: Apache-2.0\n//! bar`,
			`//! bar`,
		],
		"sourcemap comment": [`//# sourceMappingURL=foobar.js.map`, ``],
		"spdx identifier": [`// SPDX-License-Identifier: Apache-2.0`, ``],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	test("any protected comment", () => {
		fc.assert(
			fc.property(
				arb.codeWithComment("protected"),
				({ code, comment, pre, post }) => {
					fc.pre(!/(?:^|[^/])\/\/[^\n]*\n\s*$/.test(pre));
					fc.pre(!/^\s*\/\/[^\n]*\n/.test(post));

					const stripped = strip(code, options);
					assert.ok(stripped.includes(comment.trim()));
				},
			),
		);
	});

	test("any non-protected comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("non-protected"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

suite("preserve sourcemap comments", () => {
	const options = {
		...baseOptions,
		sourcemap: false,
	};

	const testdata = {
		"block comment": [`/* foobar */`, ``],
		"jsdoc comment": [`/** foobar */`, ``],
		"jsdoc license comment": [`/** @license Apache-2.0 */`, ``],
		"license header, block": [`/* Copyright (C) 2026  Henk */`, ``],
		"license header, block protected": [`/*! Copyright (C) 2026  Henk */`, ``],
		"license header, line": [`// Copyright (C) 2026  Henk`, ``],
		"license header, line protected": [`//! Copyright (C) 2026  Henk`, ``],
		"line comment": [`// foobar`, ``],
		"line comment containing a sourcemap comment": [
			`// //# sourceMappingURL=foobar.js.map`,
			``,
		],
		"protected comment, block": [`/*! foobar */`, ``],
		"protected comment, line": [`//! foobar`, ``],
		"sourcemap comment": [
			`//# sourceMappingURL=foobar.js.map`,
			`//# sourceMappingURL=foobar.js.map`,
		],
		"sourcemap comment, not quite": [`// # sourceMappingURL=fake.js.map`, ``],
		"sourcemap comment, two in row": [
			`//# sourceMappingURL=foo.js.map\n//# sourceMappingURL=bar.js.map`,
			`//# sourceMappingURL=foo.js.map\n//# sourceMappingURL=bar.js.map`,
		],
		"sourcemap comment followed by a block comment": [
			`//# sourceMappingURL=a.js.map\n/* bar */`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment followed by a jsdoc comment": [
			`//# sourceMappingURL=a.js.map\n/** bar */`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment followed by a license header, block": [
			`//# sourceMappingURL=a.js.map\n/* Copyright (C) 2026  Henk */`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment followed by a license header, line": [
			`//# sourceMappingURL=a.js.map\n// Copyright (C) 2026  Henk`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment followed by a line comment": [
			`//# sourceMappingURL=a.js.map\n// bar`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment followed by a protected comment, block": [
			`//# sourceMappingURL=a.js.map\n/*! bar */`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment followed by a protected comment, line": [
			`//# sourceMappingURL=a.js.map\n//! bar`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment followed by a spdx identifier": [
			`//# sourceMappingURL=a.js.map\n// SPDX-License-Identifier: Apache-2.0`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment lead by a block comment": [
			`/* foo *///# sourceMappingURL=a.js.map`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment lead by a jsdoc comment": [
			`/** foo *///# sourceMappingURL=a.js.map`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment lead by a license header, block": [
			`/* Copyright (C) 2026  Henk *///# sourceMappingURL=a.js.map`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment lead by a license header, line": [
			`// Copyright (C) 2026  Henk\n//# sourceMappingURL=a.js.map`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment lead by a line comment": [
			`// foo\n//# sourceMappingURL=a.js.map`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment lead by a protected comment, block": [
			`/*! foo *///# sourceMappingURL=a.js.map`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment lead by a protected comment, line": [
			`//! foo\n//# sourceMappingURL=a.js.map`,
			`//# sourceMappingURL=a.js.map`,
		],
		"sourcemap comment lead by a spdx identifier": [
			`// SPDX-License-Identifier: Apache-2.0\n//# sourceMappingURL=a.js.map`,
			`//# sourceMappingURL=a.js.map`,
		],
		"spdx identifier": [`// SPDX-License-Identifier: Apache-2.0`, ``],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	test("any sourcemap comment", () => {
		fc.assert(
			fc.property(
				arb.codeWithComment("sourcemap"),
				({ code, comment, pre, post }) => {
					fc.pre(!/(?:^|[^/])\/\/[^\n]*\n\s*$/.test(pre));
					fc.pre(!/^\s*\/\/[^\n]*\n/.test(post));

					const stripped = strip(code, options);
					assert.ok(stripped.includes(comment.trim()));
				},
			),
		);
	});

	test("any non-sourcemap comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("non-sourcemap"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

suite("preserve SPDX ID comments", () => {
	const options = {
		...baseOptions,
		spdx: false,
	};

	const testdata = {
		"block comment": [`/* foobar */`, ``],
		"jsdoc comment": [`/** foobar */`, ``],
		"jsdoc license comment": [`/** @license Apache-2.0 */`, ``],
		"license header, block": [`/* Copyright (C) 2026  Henk */`, ``],
		"license header, block protected": [`/*! Copyright (C) 2026  Henk */`, ``],
		"license header, line": [`// Copyright (C) 2026  Henk`, ``],
		"license header, line protected": [`//! Copyright (C) 2026  Henk`, ``],
		"line comment": [`// foobar`, ``],
		"line comment containing an spdx identifier": [
			`// // SPDX-License-Identifier: Apache-2.0`,
			``,
		],
		"protected comment, block": [`/*! foobar */`, ``],
		"protected comment, line": [`//! foobar`, ``],
		"sourcemap comment": [`//# sourceMappingURL=foobar.js.map`, ``],
		"spdx identifier": [
			`// SPDX-License-Identifier: Apache-2.0`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier, not quite, prefix": [
			`//x SPDX-License-Identifier: fake`,
			``,
		],
		"spdx identifier, not quite, suffix": [
			`// SPDX-License-Identifier: fake x`,
			``,
		],
		"spdx identifier, trailing whitespace": [
			`// SPDX-License-Identifier: Apache-2.0 `,
			`// SPDX-License-Identifier: Apache-2.0 `,
		],
		"spdx identifier, two in row": [
			`// SPDX-License-Identifier: Apache-2.0\n// SPDX-License-Identifier: MIT`,
			`// SPDX-License-Identifier: Apache-2.0\n// SPDX-License-Identifier: MIT`,
		],
		"spdx identifier followed by a block comment": [
			`// SPDX-License-Identifier: Apache-2.0\n/* bar */`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier followed by a jsdoc comment": [
			`// SPDX-License-Identifier: Apache-2.0\n/** bar */`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier followed by a license header, block": [
			`// SPDX-License-Identifier: Apache-2.0\n/* Copyright (C) 2026  Henk */`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier followed by a license header, line": [
			`// SPDX-License-Identifier: Apache-2.0\n// Copyright (C) 2026  Henk`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier followed by a line comment": [
			`// SPDX-License-Identifier: Apache-2.0\n// bar\nvar foo = "bar";`,
			`// SPDX-License-Identifier: Apache-2.0\nvar foo = "bar";`,
		],
		"spdx identifier followed by a protected comment, block": [
			`// SPDX-License-Identifier: Apache-2.0\n/*! bar */`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier followed by a protected comment, line": [
			`// SPDX-License-Identifier: Apache-2.0\n//! bar`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier followed by a sourcemap comment": [
			`// SPDX-License-Identifier: Apache-2.0\n//# sourceMappingURL=foobar.js.map`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier lead by a block comment": [
			`/* foo */// SPDX-License-Identifier: Apache-2.0`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier lead by a jsdoc comment": [
			`/** foo */// SPDX-License-Identifier: Apache-2.0`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier lead by a license header, block": [
			`/* Copyright (C) 2026  Henk */// SPDX-License-Identifier: Apache-2.0`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier lead by a license header, line": [
			`// Copyright (C) 2026  Henk\n// SPDX-License-Identifier: Apache-2.0`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier lead by a line comment": [
			`// foo\n// SPDX-License-Identifier: Apache-2.0\nvar foo = "bar";`,
			`// SPDX-License-Identifier: Apache-2.0\nvar foo = "bar";`,
		],
		"spdx identifier lead by a protected comment, block": [
			`/*! foo */// SPDX-License-Identifier: Apache-2.0`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier lead by a protected comment, line": [
			`//! foo\n// SPDX-License-Identifier: Apache-2.0`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier lead by a sourcemap comment": [
			`//# sourceMappingURL=foobar.js.map\n// SPDX-License-Identifier: Apache-2.0`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	test("any SPDX short-form identifier", () => {
		fc.assert(
			fc.property(
				arb.codeWithComment("spdx"),
				({ code, comment, pre, post }) => {
					fc.pre(!/(?:^|[^/])\/\/[^\n]*\n\s*$/.test(pre));
					fc.pre(!/^\s*\/\/[^\n]*\n/.test(post));

					const stripped = strip(code, options);
					assert.ok(stripped.includes(comment.trim()));
				},
			),
		);
	});

	test("any non-SPDX short-form identifier comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("non-spdx"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

test("input-output length", () => {
	const options = baseOptions;

	fc.assert(
		fc.property(arb.codeWithComment(), ({ code }) => {
			assert.ok(strip(code, options).length < code.length);
		}),
	);
});

test("idempotent", () => {
	fc.assert(
		fc.property(arb.codeWithComment(), ({ code, options }) => {
			const got = strip(code, options);
			const want = strip(got, options);
			assert.equal(got, want);
		}),
	);
});

test("syntax", () => {
	fc.assert(
		fc.property(arb.codeWithComment(), ({ code, options }) => {
			try {
				acorn.parse(code, { ecmaVersion: "latest" });
			} catch {
				fc.pre(false);
			}

			const stripped = strip(code, options);
			try {
				acorn.parse(stripped, { ecmaVersion: "latest" });
			} catch (error) {
				assert.fail(`${error} in:\n\n\`${code}\`\n\n***\n\n\`${stripped}\``);
			}
		}),
	);
});
