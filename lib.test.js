// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { suite, test } from "node:test";

import { stripComments } from "./lib.js";

const invalidCode = await readFile("./testdata/invalid.js", {
	encoding: "utf-8",
});

suite("default options", () => {
	const testdata = {
		atlicense: [
			`var foo; /** @license Apache-2.0 */`,
			`var foo; /** @license Apache-2.0 */`,
		],
		block: [`var foo; /* bar */`, `var foo;`],
		jsdoc: [`var foo; /** bar */`, `var foo;`],
		"licenseHeader, block comment": [
			`/* Copyright (C) 2025  Koe */\nvar foo;`,
			`/* Copyright (C) 2025  Koe */\nvar foo;`,
		],
		"licenseHeader, line comment": [
			`// Copyright (C) 2025  Kip\nvar foo;`,
			`// Copyright (C) 2025  Kip\nvar foo;`,
		],
		line: [`var foo; // bar`, `var foo;`],
		"protected, block comment": [`var foo; /*! bar */`, `var foo;`],
		"protected, line comment": [`var foo; //! bar`, `var foo;`],
		sourcemap: [`//# sourceMappingURL=bar.js.map\nvar foo;`, `var foo;`],
		spdx: [
			`// SPDX-License-Identifier: Apache-2.0\n\nvar foo;`,
			`// SPDX-License-Identifier: Apache-2.0\n\nvar foo;`,
		],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		test(name, () => {
			assert.equal(stripComments(inp), out);
		});
	}

	test("error", () => {
		assert.doesNotThrow(() => stripComments(invalidCode));
	});
});

suite("provided options", () => {
	test("atlicense", () => {
		const code = "/** @license Apache-2.0 */";

		{
			const got = stripComments(code, { atlicense: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { atlicense: false });
			assert.equal(got, code);
		}
	});

	test("block", () => {
		const code = "/* foobar */";

		{
			const got = stripComments(code, { block: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { block: false });
			assert.equal(got, code);
		}
	});

	test("block and atlicense", () => {
		const code = "/** @license Apache-2.0 */";

		{
			const got = stripComments(code, { atlicense: true, block: false });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { atlicense: false, block: true });
			assert.equal(got, code);
		}
	});

	test("block and jsdoc", () => {
		const code = "/** foobar */";

		{
			const got = stripComments(code, { block: false, jsdoc: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { block: true, jsdoc: false });
			assert.equal(got, code);
		}
	});

	test("block and licenseheader", () => {
		const code = "/* Copyright (C) 2025  Koe */";

		{
			const got = stripComments(code, { block: false, licenseHeader: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { block: true, licenseHeader: false });
			assert.equal(got, code);
		}
	});

	test("block and protected", () => {
		const code = "/*! foobar */";

		{
			const got = stripComments(code, { block: false, protected: true });
			assert.equal(got, code);
		}

		{
			const got = stripComments(code, { block: true, protected: false });
			assert.equal(got, code);
		}
	});

	test("error", () => {
		assert.doesNotThrow(() => stripComments(invalidCode, { error: false }));
		assert.throws(() => {
			stripComments(invalidCode, { error: true });
		}, Error);
	});

	test("jsdoc", () => {
		const code = "/** foobar */";

		{
			const got = stripComments(code, { jsdoc: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { jsdoc: false });
			assert.equal(got, code);
		}
	});

	test("jsdoc and atlicense", () => {
		const code = "/** @license Apache-2.0 */";

		{
			const got = stripComments(code, { atlicense: true, jsdoc: false });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { atlicense: false, jsdoc: true });
			assert.equal(got, code);
		}
	});

	test("licenseHeader, block comment", () => {
		const code = "/* Copyright (C) 2025  Koe */";

		{
			const got = stripComments(code, { licenseHeader: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { licenseHeader: false });
			assert.equal(got, code);
		}
	});

	test("licenseHeader, line comment", () => {
		const code = "// Copyright (C) 2025  Kip";

		{
			const got = stripComments(code, { licenseHeader: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { licenseHeader: false });
			assert.equal(got, code);
		}
	});

	test("line", () => {
		const code = "// foobar";

		{
			const got = stripComments(code, { line: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { line: false });
			assert.equal(got, code);
		}
	});

	test("line and licensHeader", () => {
		const code = "// Copyright (C) 2025  Kip";

		{
			const got = stripComments(code, { line: true, licenseHeader: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { line: true, licenseHeader: false });
			assert.equal(got, code);
		}
	});

	test("line and protected", () => {
		const code = "//! foobar";

		{
			const got = stripComments(code, { line: false, protected: true });
			assert.equal(got, code);
		}

		{
			const got = stripComments(code, { line: true, protected: false });
			assert.equal(got, code);
		}
	});

	test("line and sourcemap", () => {
		const code = "//# sourceMappingURL=foobar.js.map";

		{
			const got = stripComments(code, { line: false, sourcemap: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { line: true, sourcemap: false });
			assert.equal(got, code);
		}
	});

	test("line and spdx", () => {
		const code = "// SPDX-License-Identifier: Apache-2.0";

		{
			const got = stripComments(code, { line: false, spdx: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { line: true, spdx: false });
			assert.equal(got, code);
		}
	});

	test("pattern", () => {
		const code = "/* foo */\n/** foo */\// foo\n/*! foo */\n//! foo";

		{
			const got = stripComments(code, /foo/);
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { pattern: /foo/ });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, /bar/);
			assert.equal(got, code);
		}

		{
			const got = stripComments(code, { pattern: /bar/ });
			assert.equal(got, code);
		}
	});

	test("pattern and block", () => {
		const code = "/* foobar */";

		{
			const got = stripComments(code, { block: true, pattern: /foobar/ });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { block: false, pattern: /foobar/ });
			assert.equal(got, code);
		}

		{
			const got = stripComments(code, { block: true, pattern: /foobaz/ });
			assert.equal(got, code);
		}

		{
			const got = stripComments(code, { block: false, pattern: /foobaz/ });
			assert.equal(got, code);
		}
	});

	test("pattern and line", () => {
		const code = "// foobar";

		{
			const got = stripComments(code, { line: true, pattern: /foobar/ });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { line: false, pattern: /foobar/ });
			assert.equal(got, code);
		}

		{
			const got = stripComments(code, { line: true, pattern: /foobaz/ });
			assert.equal(got, code);
		}

		{
			const got = stripComments(code, { line: false, pattern: /foobaz/ });
			assert.equal(got, code);
		}
	});

	test("protected, block comment", () => {
		const code = "/*! foobar */";

		{
			const got = stripComments(code, { protected: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { protected: false });
			assert.equal(got, code);
		}
	});

	test("protected, line comment", () => {
		const code = "//! foobar";

		{
			const got = stripComments(code, { protected: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { protected: false });
			assert.equal(got, code);
		}
	});

	test("sourcemap", () => {
		const code = "//# sourceMappingURL=foobar.js.map";

		{
			const got = stripComments(code, { sourcemap: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { sourcemap: false });
			assert.equal(got, code);
		}
	});

	test("spdx", () => {
		const code = "// SPDX-License-Identifier: Apache-2.0";

		{
			const got = stripComments(code, { spdx: true });
			assert.equal(got, "");
		}

		{
			const got = stripComments(code, { spdx: false });
			assert.equal(got, code);
		}
	});
});
