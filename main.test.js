// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert/strict";
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
	licenseHeader: true,
	line: true,
	protected: true,
	sourcemap: true,
	spdx: true,
});

test("testdata", async (t) => {
	for (using testcase of await testdata.files()) {
		await t.test(testcase.name, async () => {
			const options = {
				...baseOptions,
				...testcase.options,
			};

			const got = strip(testcase.original, options);
			assert.equal(got, testcase.want);
		});
	}
});

test("newlines", async (t) => {
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
		"trim ' '": [" // comment", ""],
		"trim '\\t'": ["\t// comment", ""],
		"trim '\\f'": ["\f// comment", ""],
		"trim '\\v'": ["\v// comment", ""],
		"trim '\\u00a0'": ["\u00a0// comment", ""],
		"trim '\\u1680'": ["\u1680// comment", ""],
		"trim '\\u2000'": ["\u2000// comment", ""],
		"trim '\\u2001'": ["\u2001// comment", ""],
		"trim '\\u2002'": ["\u2002// comment", ""],
		"trim '\\u2003'": ["\u2003// comment", ""],
		"trim '\\u2004'": ["\u2004// comment", ""],
		"trim '\\u2005'": ["\u2005// comment", ""],
		"trim '\\u2000'": ["\u2006// comment", ""],
		"trim '\\u2007'": ["\u2007// comment", ""],
		"trim '\\u2008'": ["\u2008// comment", ""],
		"trim '\\u2009'": ["\u2009// comment", ""],
		"trim '\\u200a'": ["\u200a// comment", ""],
		"trim '\\u2028'": ["\u2028// comment", ""],
		"trim '\\u2029'": ["\u2029// comment", ""],
		"trim '\\u202f'": ["\u202f// comment", ""],
		"trim '\\u205f'": ["\u205f// comment", ""],
		"trim '\\u3000'": ["\u3000// comment", ""],
		"trim '\\ufeff'": ["\ufeff// comment", ""],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		await t.test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}
});

test("pattern", async (t) => {
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
			inp: "/**\n * hello\n * world\n */var x = 'Hello world!'",
			want: "var x = 'Hello world!'",
		},
		"multiline block comment with leading '*', indented": {
			pattern: /hello world/,
			inp: "\t/**\n\t * hello\n\t * world\n\t */var x = 'Hello world!'",
			want: "var x = 'Hello world!'",
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
	};

	for (const [name, testcase] of Object.entries(testdata)) {
		await t.test(name, () => {
			const options = {
				...baseOptions,
				pattern: testcase.pattern,
			};

			assert.equal(strip(testcase.inp, options), testcase.want);
		});
	}

	await t.test("not a regexp", async (t) => {
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
			await t.test(name, () => {
				const options = {
					...baseOptions,
					pattern,
				};

				assert.throws(() => {
					strip("this is not fine", options);
				}, /^Error: pattern must be a RegExp$/);
			});
		}
	});
});

test("pathological input", async (t) => {
	await t.test("general", async (t) => {
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
			"double quote string with escaped character": ['"\\t" // a', '"\\t"'],
			"double quote string with escaped quote": ['"\\"" // b', '"\\""'],
			"single quote string with escaped character": ["'a\\tb' // c", "'a\\tb'"],
			"single quote string with escaped quote": ["'a\\'b' // d", "'a\\'b'"],
			"regexp starting block w/ line comment": ["/\\/*/ // a", "/\\/*/"],
			"regexp starting block w/ block comment": ["/\\/*/ /*b*/", "/\\/*/"],
			"char class starting block w/ line comment": ["/{[/*]}/ //c", "/{[/*]}/"],
			"char class starting block w/ block comment": ["/[/*]/ /*d*/", "/[/*]/"],
			"char class starting line w/ line comment": ["/[//]/ // e", "/[//]/"],
			"char class starting line w/ block comment": ["/[//]/ /*f*/", "/[//]/"],
			"division, line comment": ["3/14 // a", "3/14"],
			"division, line comment, parentheses": ["(3+1)/(4) // b", "(3+1)/(4)"],
			"division, block comment": ["6 / 7 /* c */", "6 / 7"],
			"division, block comment, parentheses": ["(6)/(8-1) /*d*/", "(6)/(8-1)"],
			"division, nested": ["if(x){(1/2)/3} // test", "if(x){(1/2)/3}"],
			"division, after return": ["return x; 3/14; // a", "return x; 3/14;"],
			"division, after delete": ["delete a.b; 3/14; // a", "delete a.b; 3/14;"],
			"control flow body block comment": ["if (x) /* inc */ x++", "if (x) x++"],
			"control flow body line comment": ["if(x) // inc\n  x++", "if(x)\n  x++"],
			"block followed by line comment": ["/* a */ // b", ""],
			"line followed by block comment": ["// b\n/* a */", ""],
		};

		for (const [name, [inp, out]] of Object.entries(testdata)) {
			await t.test(name, () => {
				assert.equal(strip(inp, options), out);
			});
		}
	});

	await t.test("regexp", async (t) => {
		await t.test("general", async (t) => {
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
				"expression statement": ";%s;",
				"nth in comma operator": "1,%s;",
				"for-in": "for (var x in %s) x",
				"for-of": "for (var x of %s) x",
				"do-while body": "do %s; while (g)",
				"else body": "if (g) { } else %s;",
				"for body": "for (x in y) %s;",
				"if body": "if (g) %s;",
				"switch-case body": "switch(x){\ncase: %s;\n}",
				"switch-default body": "switch(x){\ncase: break;\ndefault: %s\n}",
				"while body": "while  (g) %s;",
				"with body": "with (x) %s;",
				"delete expression": "delete %s;",
				"in expression": "if(x in %s) f();",
				"instanceof expression": "x => x instanceof %s;",
				"new expression": "() => new %s;",
				"throw expression": "throw %s;",
				"typeof expression": "typeof %s;",
				"void expression": "void %s;",
				"yield expression": "function* g(){yield %s}",
				"default export": "export default %s;",
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

			const expressions = ["/'/", "delete /'/"];

			for (const expression of expressions) {
				await t.test(expression, async (t) => {
					for (const [name, template] of Object.entries(templates)) {
						await t.test(name, () => {
							const out = template.replace("%s", expression);
							const inp = `${out} // test`;
							assert.equal(strip(inp, options), out);
						});
					}
				});
			}
		});

		await t.test("keywords without a space", async (t) => {
			const options = baseOptions;

			const templates = {
				"for-in": "for (var x in%s) x",
				"for-of": "for (var x of%s) x",
				"do-while body": "do%s; while (g)",
				"else body": "if (a) { } else%s;",
				"await expression": "await%s;",
				"delete expression": "delete%s;",
				"in expression": "if (x in%s) f()",
				"instanceof expression": "x => x instanceof%s;",
				"new expression": "new%s;",
				"return expression": "function f(){return%s;}",
				"throw expression": "throw%s;",
				"typeof expression": "typeof%s;",
				"void expression": "void%s;",
				"yield expression": "function* g(){yield%s;}",
			};

			for (const [name, template] of Object.entries(templates)) {
				await t.test(name, () => {
					const out = template.replace("%s", "/'/");
					const inp = `${out} // test`;
					assert.equal(strip(inp, options), out);
				});
			}
		});

		await t.test("after preserved comment", async (t) => {
			const expressions = ["/'/", "delete /'/"];

			await t.test("block", async (t) => {
				const options = {
					...baseOptions,
					block: false,
				};

				const template = "/**/%s;";

				for (const expression of expressions) {
					await t.test(expression, async () => {
						const out = template.replace("%s", expression);
						const inp = `${out} // test`;
						assert.equal(strip(inp, options), out);
					});
				}
			});

			await t.test("line", async (t) => {
				const options = {
					...baseOptions,
					line: false,
				};

				const template = "// test\n%s;";

				for (const expression of expressions) {
					await t.test(expression, async () => {
						const out = template.replace("%s", expression);
						const inp = `${out} /*test*/`;
						assert.equal(strip(inp, options), out);
					});
				}
			});
		});

		await t.test("whitespace", async (t) => {
			const options = baseOptions;

			const testdata = {
				"<space>": " ",
				"\\t": "\t",
				"\\f": "\f",
				"\\v": "\v",
				"\\u00a0": "\u00a0",
				"\\u1680": "\u1680",
				"\\u2000": "\u2000",
				"\\u2001": "\u2001",
				"\\u2002": "\u2002",
				"\\u2003": "\u2003",
				"\\u2004": "\u2004",
				"\\u2005": "\u2005",
				"\\u2006": "\u2006",
				"\\u2007": "\u2007",
				"\\u2008": "\u2008",
				"\\u2009": "\u2009",
				"\\u200a": "\u200a",
				"\\u2028": "\u2028",
				"\\u2029": "\u2029",
				"\\u202f": "\u202f",
				"\\u205f": "\u205f",
				"\\u3000": "\u3000",
				"\\ufeff": "\ufeff",
			};

			for (const [name, testcase] of Object.entries(testdata)) {
				await t.test(name, () => {
					const out = `1 + ${testcase}/'/`;
					const inp = `${out} // test`;
					assert.equal(strip(inp, options), out);
				});
			}
		});
	});

	await t.test("template literal", async (t) => {
		const options = baseOptions;

		const testdata = {
			"block comment in expression": ["`${/* foobar */}`", "`${}`"],
			"line comment in expression": ["`${// foobar\n}`", "`${\n}`"],
			"comment in almost expression": ["`\\${/* foo */}`", "`\\${/* foo */}`"],
			"comment following a 1": ["`$ /* foo */}`", "`$ /* foo */}`"],
		};

		for (const [name, [inp, out]] of Object.entries(testdata)) {
			await t.test(name, () => {
				assert.equal(strip(inp, options), out);
			});
		}
	});
});

test("invalid source code", async (t) => {
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
		"unclosed regex": "/*invalid*/ var foo = /bar",
		"unclosed regex as control flow body": "/*invalid*/ while (foo) /bar",
		"unmatched closing '}'": "var foo = 'bar'} /*invalid*/",
		"unmatched closing ')'": "function foo) { var bar = 42; } /*invalid*/",
	};

	for (const [name, inp] of Object.entries(testdata)) {
		await t.test(name, () => {
			assert.equal(strip(inp, options), inp);
		});
	}
});

test("preserve block comments", async (t) => {
	const options = {
		...baseOptions,
		block: false,
	};

	const testdata = {
		"block comment": [`// foobar`, ``],
		"line comment": [`/* foobar */`, `/* foobar */`],
		"jsdoc comment": [`/** foobar */`, `/** foobar */`],
		"protected block comment": [`/*! foobar */`, `/*! foobar */`],
		"protected line comment": [`//! foobar`, ``],
		"sourcemap comment": [`//# sourceMappingURL=foobar.js.map`, ``],
		"license header, block": [
			`/* Copyright (C) 2026  Henk */`,
			`/* Copyright (C) 2026  Henk */`,
		],
		"license header, line": [`// Copyright (C) 2026  Henk`, ``],
		"spdx identifier": [`// SPDX-License-Identifier: Apache-2.0`, ``],
		"line comment in block comment": [`/* // a */`, `/* // a */`],
		"line comment after block comment": [`/**///`, `/**/`],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		await t.test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	await t.test("any block comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("block"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	await t.test("any line comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("line"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

test("preserve line comments", async (t) => {
	const options = {
		...baseOptions,
		line: false,
	};

	const testdata = {
		"block comment": [`// foobar`, `// foobar`],
		"line comment": [`/* foobar */`, ``],
		"jsdoc comment": [`/** foobar */`, ``],
		"protected block comment": [`/*! foobar */`, ``],
		"protected line comment": [`//! foobar`, `//! foobar`],
		"sourcemap comment": [
			`//# sourceMappingURL=foobar.js.map`,
			`//# sourceMappingURL=foobar.js.map`,
		],
		"license header, block": [`/* Copyright (C) 2026  Henk */`, ``],
		"license header, line": [
			`// Copyright (C) 2026  Henk`,
			`// Copyright (C) 2026  Henk`,
		],
		"spdx identifier": [
			`// SPDX-License-Identifier: Apache-2.0`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"line comment in line comment": [`//// a`, `//// a`],
		"block comment in line comment": [`// /* b */`, `// /* b */`],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		await t.test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	await t.test("any line comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("line"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	await t.test("any block comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("block"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

test("preserve JSDoc comments", async (t) => {
	const options = {
		...baseOptions,
		jsdoc: false,
	};

	const testdata = {
		"block comment": [`// foobar`, ``],
		"line comment": [`/* foobar */`, ``],
		"jsdoc comment, single line": [`/** foobar */`, `/** foobar */`],
		"jsdoc comment, multiline": [`/**\n * foobar\n */`, `/**\n * foobar\n */`],
		"protected block comment": [`/*! foobar */`, ``],
		"protected line comment": [`//! foobar`, ``],
		"sourcemap comment": [`//# sourceMappingURL=foobar.js.map`, ``],
		"license header": [`// Copyright (C) 2026  Henk`, ``],
		"spdx identifier": [`// SPDX-License-Identifier: Apache-2.0`, ``],
		"line comment in JSDoc comment": [`/** // a */`, `/** // a */`],
		"line comment after JSDoc comment": [`/***///`, `/***/`],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		await t.test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	await t.test("any JSDoc comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("jsdoc"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(stripped.includes(comment.trim()));
			}),
		);
	});

	await t.test("any (non-JSDoc) block comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("non-jsdoc"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});

	await t.test("any line comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("line"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

test("preserve protected comments", async (t) => {
	const options = {
		...baseOptions,
		protected: false,
	};

	const testdata = {
		"block comment": [`// foobar`, ``],
		"line comment": [`/* foobar */`, ``],
		"jsdoc comment": [`/** foobar */`, ``],
		"protected block comment": [`/*! foobar */`, `/*! foobar */`],
		"protected line comment": [`//! foobar`, `//! foobar`],
		"sourcemap comment": [`//# sourceMappingURL=foobar.js.map`, ``],
		"license header": [`// Copyright (C) 2026  Henk`, ``],
		"spdx identifier": [`// SPDX-License-Identifier: Apache-2.0`, ``],
		"line comment in protected comment": [`/*! // a */`, `/*! // a */`],
		"line comment after protected comment": [`/*!*///`, `/*!*/`],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		await t.test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	await t.test("any protected comment", () => {
		fc.assert(
			fc.property(
				arb.codeWithComment("protected"),
				({ code, comment, pre, post }) => {
					fc.pre(!/\/\/[^\n]*\n\s*$/.test(pre));
					fc.pre(!/^\s*\/\/[^\n]*\n/.test(post));

					const stripped = strip(code, options);
					assert.ok(stripped.includes(comment.trim()));
				},
			),
		);
	});

	await t.test("any non-protected comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("non-protected"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

test("preserve sourcemap comments", async (t) => {
	const options = {
		...baseOptions,
		sourcemap: false,
	};

	const testdata = {
		"block comment": [`// foobar`, ``],
		"line comment": [`/* foobar */`, ``],
		"jsdoc comment": [`/** foobar */`, ``],
		"protected block comment": [`/*! foobar */`, ``],
		"protected line comment": [`//! foobar`, ``],
		"sourcemap comment": [
			`//# sourceMappingURL=foobar.js.map`,
			`//# sourceMappingURL=foobar.js.map`,
		],
		"license header": [`// Copyright (C) 2026  Henk`, ``],
		"spdx identifier": [`// SPDX-License-Identifier: Apache-2.0`, ``],
		"not quite a sourcemap comment": [`// # sourceMappingURL=fake.js.map`, ``],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		await t.test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	await t.test("any sourcemap comment", () => {
		fc.assert(
			fc.property(
				arb.codeWithComment("sourcemap"),
				({ code, comment, pre, post }) => {
					fc.pre(!/\/\/[^\n]*\n\s*$/.test(pre));
					fc.pre(!/^\s*\/\/[^\n]*\n/.test(post));

					const stripped = strip(code, options);
					assert.ok(stripped.includes(comment.trim()));
				},
			),
		);
	});

	await t.test("any non-sourcemap comment", () => {
		fc.assert(
			fc.property(arb.codeWithComment("non-sourcemap"), ({ code, comment }) => {
				const stripped = strip(code, options);
				assert.ok(!stripped.includes(comment));
			}),
		);
	});
});

test("preserve license header comments", async (t) => {
	const options = {
		...baseOptions,
		licenseHeader: false,
	};

	const testdata = {
		"block comment": [`// foobar`, ``],
		"line comment": [`/* foobar */`, ``],
		"jsdoc comment": [`/** foobar */`, ``],
		"protected block comment": [`/*! foobar */`, ``],
		"protected line comment": [`//! foobar`, ``],
		"sourcemap comment": [`//# sourceMappingURL=foobar.js.map`, ``],
		"license header, block": [
			`/* Copyright (C) 2026  Kip\n *\n * This program is free software: ...*/`,
			`/* Copyright (C) 2026  Kip\n *\n * This program is free software: ...*/`,
		],
		"license header, line": [
			`// Copyright (C) 2026  Henk\n//\n// This program is free software: ...`,
			`// Copyright (C) 2026  Henk\n//\n// This program is free software: ...`,
		],
		"spdx identifier": [`// SPDX-License-Identifier: Apache-2.0`, ``],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		await t.test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	await t.test("any license header", () => {
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

	await t.test("any non-license header comment", () => {
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

test("preserve SPDX ID comments", async (t) => {
	const options = {
		...baseOptions,
		spdx: false,
	};

	const testdata = {
		"block comment": [`// foobar`, ``],
		"line comment": [`/* foobar */`, ``],
		"jsdoc comment": [`/** foobar */`, ``],
		"protected block comment": [`/*! foobar */`, ``],
		"protected line comment": [`//! foobar`, ``],
		"sourcemap comment": [`//# sourceMappingURL=foobar.js.map`, ``],
		"license header": [`// Copyright (C) 2026  Henk`, ``],
		"spdx identifier": [
			`// SPDX-License-Identifier: Apache-2.0`,
			`// SPDX-License-Identifier: Apache-2.0`,
		],
		"spdx identifier with trailing whitespace": [
			`// SPDX-License-Identifier: Apache-2.0 `,
			`// SPDX-License-Identifier: Apache-2.0 `,
		],
		"not quite #1": [`//x SPDX-License-Identifier: fake`, ``],
		"not quite #2": [`// SPDX-License-Identifier: fake x`, ``],
	};

	for (const [name, [inp, out]] of Object.entries(testdata)) {
		await t.test(name, () => {
			assert.equal(strip(inp, options), out);
		});
	}

	await t.test("any SPDX short-form identifier", () => {
		fc.assert(
			fc.property(
				arb.codeWithComment("spdx"),
				({ code, comment, pre, post }) => {
					fc.pre(!/\/\/[^\n]*\n\s*$/.test(pre));
					fc.pre(!/^\s*\/\/[^\n]*\n/.test(post));

					const stripped = strip(code, options);
					assert.ok(stripped.includes(comment.trim()));
				},
			),
		);
	});

	await t.test("any non-SPDX short-form identifier comment", () => {
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
