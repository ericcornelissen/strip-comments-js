// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert";
import * as fs from "node:fs/promises";
import { test } from "node:test";

import * as acorn from "acorn";
import * as fc from "fast-check";

import * as arb from "./arbitraries.js";
import * as testdata from "./testdata.js";

import { strip } from "./main.js";

const baseOptions = Object.freeze({
	pattern: /[^]?/,
	block: true,
	jsdoc: true,
	line: true,
	protected: true,
	sourcemap: true,
	spdx: true,
});

test("testdata", async () => {
	const options = baseOptions;

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
	const options = baseOptions;

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
				...baseOptions,
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
					...baseOptions,
					pattern,
				};

				assert.throws(() => strip("this is not fine", options));
			});
		}
	});
});

test("pathological input", async () => {
	await test("general", async () => {
		const options = baseOptions;

		const testdata = {
			"only an empty line comment": ["//", ""],
			"only a non-empty line comment": ["// test", ""],
			"only an empty line comment with a newline": ["//\n", ""],
			"only a non-empty line comment with a newline": ["// test\n", ""],
			"only an empty block comment": ["/**/", ""],
			"only a non-empty block comment": ["/* test */", ""],
			"a trailing line comment": ["x;// test\n", "x;\n"],
			"a trailing block comment": ["x;/* test */\n", "x;\n"],
			"odd block comment 1": ["/*/**/", ""],
			"odd block comment 2": ["/*/*/", ""],
			"regexp starting block w/ line comment": ["/\\/*/ // a", "/\\/*/"],
			"regexp starting block w/ block comment": ["/\\/*/ /*b*/", "/\\/*/"],
			"char class starting block w/ line comment": ["/[/*]/ // c", "/[/*]/"],
			"char class starting block w/ block comment": ["/[/*]/ /*d*/", "/[/*]/"],
			"char class starting line w/ line comment": ["/[//]/ // e", "/[//]/"],
			"char class starting line w/ block comment": ["/[//]/ /*f*/", "/[//]/"],
			"division, line comment": ["3/14 // a", "3/14"],
			"division, line comment, parentheses": ["(3+1)/(4) // b", "(3+1)/(4)"],
			"division, block comment": ["6 / 7 /* c */", "6 / 7"],
			"division, block comment, parentheses": ["(6)/(8-1) /*d*/", "(6)/(8-1)"],
		};

		for (const [name, [inp, out]] of Object.entries(testdata)) {
			await test(name, () => {
				assert.equal(strip(inp, options), out);
			});
		}
	});

	await test("regexp", async () => {
		await test("general", async () => {
			const options = baseOptions;

			const templates = {
				"assignment value": "let obj = %s;",
				"object value": "let obj = { prop: %s };",
				"object key": "let obj = { [%s]: 42 };",
				"1st array value": "let arr = [%s];",
				"nth array value": "let arr = [0, %s];",
				"object dynamic access": "obj[%s];",
				"template literal expression": "let tle = `${%s}`;",
				"1st function argument": "f(%s);",
				"nth function argument": "f('n/a', %s);",
				"return expression": "function f() { return %s; }",
				"await expression": "await %s;",
				"default parameter expression": "function f(r=%s) {}",
				"arrow function expression": "() => %s;",
				"start of a block statement": "{%s}",
				"after a block statement": "{}%s",
				"if body": "if (g) %s;",
				"else body": "if (g) { } else %s;",
				"for body": "for (x in y) %s;",
				"while body": "while (g) %s;",
				"do-while body": "do %s; while (g)",
				"for-in": "for (var x in %s) x",
				"for-of": "for (var x of %s) x",
				"expression statement": ";%s;",
				"in-operator": "if (x in %s) f();",
				"nth in comma operator": "1,%s;",
				"delete expression": "delete %s;",
				"instanceof expression": "x => x instanceof %s;",
				"typeof expression": "typeof %s;",
				"void expression": "void %s;",
				"unary plus": "var p = +%s;",
				"unary minus": "var m = -%s;",
				"bitwise not": "var bnot = ~%s;",
				"logcal not": "var lnot = !%s;",
				"arithmetic addition": "var a = 1 + %s;",
				"arithmetic subtraction": "var s = 1 - %s;",
				"arithmetic multiplication": "var m = 1 * %s;",
				"arithmetic division": "var d = 1 / %s;",
				"arithmetic remainer": "var r = 1 % %s;",
				"arithmetic exponentiation": "var e = 1 ** %s;",
				"left shift": "var ls = 1 << %s;",
				"right shift": "var rs = 1 >> %s;",
				"unsigned right shift": "var urs = 1 >>> %s;",
				"bitwise AND": "var band = 1 & %s;",
				"bitwise XOR": "var bxor = 1 ^ %s;",
				"bitwise OR": "var bor = 1 | %s;",
				"logical AND": "var land = true && %s;",
				"logical OR": "var lor = true || %s;",
				"nullish coalescing": "var n = null ?? %s;",
				"greater than": "var gt = 42 > %s;",
				"greater than or equal": "var gte = 42 >= %s;",
				"less than": "var lt = 42 < %s;",
				"less than or equal": "var lte = 42 <= %s;",
				"equals check": "if (a == %s) f();",
				"not equals check": "if (a != %s) f();",
				"strict equals check": "if (a === %s) f();",
				"strict not equals check": "if (a !== %s) f();",
				"ternary, first branch": "var f = g ? %s : 2;",
				"ternary, second branch": "var s = g ? 1 : %s;",
			};

			const expressions = [
				"/'/",
				"delete /'/",
				"typeof /'/",
				"instanceof /'/",
				"void /'/",
			];

			for (const expression of expressions) {
				await test(expression, async () => {
					for (const [name, template] of Object.entries(templates)) {
						await test(`"${name}"`, () => {
							const out = template.replace("%s", expression);
							const inp = `${out} // test`;
							assert.equal(strip(inp, options), out);
						});
					}
				});
			}
		});

		await test("keywords without a space", async () => {
			const options = baseOptions;

			const templates = {
				"await expression": "await%s;",
				"delete expression": "delete%s;",
				"instanceof expression": "x => x instanceof%s;",
				"typeof expression": "typeof%s;",
				"void expression": "void%s;",
				"return expression": "function f(){return%s;}",
				"in expression": "if (x in%s) f()",
				"for-in": "for (var x in%s) x",
				"for-of": "for (var x of%s) x",
				"else body": "if (a) { } else%s;",
				"do-while body": "do%s; while (g)",
			};

			for (const [name, template] of Object.entries(templates)) {
				await test(name, () => {
					const out = template.replace("%s", "/'/");
					const inp = `${out} // test`;
					assert.equal(strip(inp, options), out);
				});
			}
		});

		await test("after preserved comment", async () => {
			const expressions = ["/'/", "delete /'/"];

			await test("block", async () => {
				const options = {
					...baseOptions,
					block: false,
				};

				const template = "/**/%s;";

				for (const expression of expressions) {
					await test(expression, async () => {
						const out = template.replace("%s", expression);
						const inp = `${out} // test`;
						assert.equal(strip(inp, options), out);
					});
				}
			});

			await test("line", async () => {
				const options = {
					...baseOptions,
					line: false,
				};

				const template = "// test\n%s;";

				for (const expression of expressions) {
					await test(expression, async () => {
						const out = template.replace("%s", expression);
						const inp = `${out} /*test*/`;
						assert.equal(strip(inp, options), out);
					});
				}
			});
		});
	});
});

test("invalid source code", async () => {
	const options = baseOptions;

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
		...baseOptions,
		block: false,
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
		...baseOptions,
		jsdoc: false,
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
		...baseOptions,
		line: false,
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
		...baseOptions,
		protected: false,
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
		...baseOptions,
		sourcemap: false,
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
		...baseOptions,
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
