// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import { test } from "node:test";

import * as acorn from "acorn";
import * as fc from "fast-check";

import * as arb from "./arbitraries.js";
import * as testdata from "./testdata.js";

import { strip } from "./main.js";

test("testdata", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
		sourcemap: true,
		spdx: true,
	};

	for (const [file, filepath] of await testdata.files()) {
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
		sourcemap: true,
		spdx: true,
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

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		await test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}
});

test("pattern", async () => {
	const defaultOptions = {
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
		sourcemap: true,
		spdx: true,
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
			pattern: /bar\s*$/,
			inp: "var x = y; /* foobar */\n",
			want: "var x = y;\n",
		},
		"pattern with end of string anchor, line comment ending in CRLF": {
			pattern: /bar$/,
			inp: "var x = y; // foobar\r\n",
			want: "var x = y;\r\n",
		},
		"multiline block comment with leading '*'": {
			pattern: /hello world/,
			inp: "/**\n * hello\n * world\n */",
			want: "",
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

	await test("not a regexp", async () => {
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
			await test(name, () => {
				const options = {
					...defaultOptions,
					pattern,
				};

				assert.throws(() => strip("this is not fine", options));
			});
		}
	});
});

test("pathological input", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
		sourcemap: true,
		spdx: true,
	};

	const testdata = {
		"only an empty line comment": ["//", ""],
		"only a non-empty line comment": ["// ", ""],
		"only a line comment with a newline": ["//\n", ""],
		"only trailing line comment": ["x;//\n", "x;\n"],
		"only an empty block comment": ["/**/", ""],
		"only a non-empty block comment": ["/* */", ""],
		"odd block comment 1": ["/*/**/", ""],
		"odd block comment 2": ["/*/*/", ""],
		"regexp with line comment, 1": ["/\\/\\// // a", "/\\/\\//"],
		"regexp with line comment, 2": ["/\\/*/ // b", "/\\/*/"],
		"regexp with line comment, 3": ["/[//]/ // c", "/[//]/"],
		"regexp with line comment, 4": ["/[/*]/ // d", "/[/*]/"],
		"regexp with block comment, 1": ["/\\/\\// /* a */", "/\\/\\//"],
		"regexp with block comment, 2": ["/\\/*/ /* b */", "/\\/*/"],
		"regexp with block comment, 3": ["/[//]/ /* c */", "/[//]/"],
		"regexp with block comment, 4": ["/[/*]/ /* d */", "/[/*]/"],
		"regexp colon": ["let a={b:/'/}; // test", "let a={b:/'/};"],
		"regexp opening parenthesis": ["f(/'/i); // test", "f(/'/i);"],
		"regexp after comma": ["f('n/a', /}/i); // test", "f('n/a', /}/i);"],
		"regexp in return": ["() => return/'/; // test", "() => return/'/;"],
		"regexp in unary plus": ["if (+/\\}/) { } // test", "if (+/\\}/) { }"],
		"regexp in unary minus": ["if (-/\\}/) { } // test", "if (-/\\}/) { }"],
		"regexp in array expression": ["[/'/] // test", "[/'/]"],
		"regexp in delete expression": ["delete /'/ // test", "delete /'/"],
		"regexp in void expression": ["void /'/ // test", "void /'/"],
		"regexp in nested delete/void": ["delete void/'///**/", "delete void/'/"],
		"regexp begin of block statement": ["{/}/} // test", "{/}/}"],
		"regexp after block statement": ["{}/'/ // test", "{}/'/"],
		"regexp in for-in": ["for(var x in/'/)/**/x", "for(var x in/'/)x"],
		"regexp in for-of": ["for(var x of/'/)/**/x", "for(var x of/'/)x"],
		"regexp in an in-operator": ["'x' in /'/g // test", "'x' in /'/g"],
		"regexp in-op delete": ["'x' in delete /'/g // test", "'x' in delete /'/g"],
		"regexp as else body": ["if(a){} else/}/; // test", "if(a){} else/}/;"],
		"regexp as if body": ["if (a) /}/; // test", "if (a) /}/;"],
		"regexp as for body": ["for(x in y) /}/; // test", "for(x in y) /}/;"],
		"regexp as while body": ["while(a)/}/; // test", "while(a)/}/;"],
		"regexp with a '/' in a character class": ["/[/']/ // test", "/[/']/"],
		"division with line comment, 1": ["3/14 // a", "3/14"],
		"division with line comment, 2": ["(3+1)/(4) // a", "(3+1)/(4)"],
		"division with block comment, 1": ["6 / 7 /* b */", "6 / 7"],
		"division with block comment, 2": ["(6) / (8-1) /* b */", "(6) / (8-1)"],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		await test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}
});

test("invalid source code", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
		sourcemap: true,
		spdx: true,
	};

	const testdata = {
		"unclosed block statement": "/*invalid*/ function foo() { var bar = 42;",
		"unclosed argument list": "/*invalid*/ function foo( { var bar = 42; }",
		"unclosed object literal": "/*invalid*/ var foo = { bar: 42",
		"unclosed string, single quote": "/*invalid*/ var foo = 'bar",
		"unclosed string, double quote": '/*invalid*/ var foo = "bar',
		"unclosed string, backticks": "/*invalid*/ var foo = `bar",
		"unclosed template literal expression": "/*invalid*/ var foo = `${bar`",
		"unclosed block comment": "/*invalid*/ var foo = 'bar'; /*",
		"unclosed regular expression": "/*invalid*/ var foo = /bar",
		"unmatched closing '}'": "var foo = 'bar'} /*invalid*/",
		"unmatched closing ')'": "function foo) { var bar = 42; } /*invalid*/",
	};

	for (const [name, inp] of Object.entries(testdata)) {
		await test(name, () => {
			assert.equal(strip(inp, options), inp);
		});
	}
});

test("preserve block comments", async () => {
	const options = {
		pattern: /[^]?/,
		block: false,
		jsdoc: true,
		line: true,
		protected: true,
		sourcemap: true,
		spdx: true,
	};

	await test("any block comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("block"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	await test("any line comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("line"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});

	await test("pathological input", async () => {
		const testdata = {
			"line comment in block comment": [`/* // a */`, `/* // a */`],
			"line comment after block comment": [`/**///`, `/**/`],
		};

		for (const [name, [inp, out]] of Object.entries(testdata)) {
			await test(name, () => {
				assert.equal(strip(inp, options), out);
			});
		}
	});
});

test("preserve JSDoc comments", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: false,
		line: true,
		protected: true,
		sourcemap: true,
		spdx: true,
	};

	await test("any JSDoc comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("jsdoc"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	await test("any (non-JSDoc) block comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("non-jsdoc"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});

	await test("any line comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("line"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});

	await test("pathological input", async () => {
		const testdata = {
			"line comment in JSDoc comment": [`/** // a */`, `/** // a */`],
			"line comment after JSDoc comment": [`/***///`, `/***/`],
		};

		for (const [name, [inp, out]] of Object.entries(testdata)) {
			await test(name, () => {
				assert.equal(strip(inp, options), out);
			});
		}
	});
});

test("preserve line comments", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: false,
		protected: true,
		sourcemap: true,
		spdx: true,
	};

	await test("any line comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("line"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	await test("any block comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("block"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});

	await test("pathological input", async () => {
		const testdata = {
			"line comment in line comment": [`//// a`, `//// a`],
			"block comment in line comment": [`// /* b */`, `// /* b */`],
		};

		for (const [name, [inp, out]] of Object.entries(testdata)) {
			await test(name, () => {
				assert.equal(strip(inp, options), out);
			});
		}
	});
});

test("preserve protected comments", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: false,
		sourcemap: true,
		spdx: true,
	};

	await test("any protected comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("protected"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	await test("any non-protected comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("non-protected"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});

	await test("pathological input", async () => {
		const testdata = {
			"line comment in protected comment": [`/*! // a */`, `/*! // a */`],
			"line comment after protected comment": [`/*!*///`, `/*!*/`],
		};

		for (const [name, [inp, out]] of Object.entries(testdata)) {
			await test(name, () => {
				assert.equal(strip(inp, options), out);
			});
		}
	});
});

test("preserve sourcemap comments", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
		sourcemap: false,
		spdx: true,
	};

	await test("any sourcemap comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("sourcemap"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	await test("any non-sourcemap comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("non-sourcemap"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

test("preserve SPDX ID comments", async () => {
	const options = {
		pattern: /[^]?/,
		block: true,
		jsdoc: true,
		line: true,
		protected: true,
		sourcemap: true,
		spdx: false,
	};

	await test("any SPDX short-form identifier", () => {
		fc.assert(
			fc.property(arb.codeWithComment("spdx"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	await test("any non-SPDX short-form identifier comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("non-spdx"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
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
		sourcemap: true,
		spdx: true,
	};

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
