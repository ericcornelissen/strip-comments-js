// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert/strict";
import { test } from "node:test";

import * as fc from "fast-check";

import { strip } from "./main.js";

const examples = [
	`var x = y == z; // eslint-disable-line eqeqeq`,
	`var x;
// eslint-disable-next-line no-undefined
var y;`,
	`var x;

/* eslint-disable */
var y;
/* eslint-enable */

var z;`,
	`/* eslint-disable */*/`,
];

for (const i in examples) {
	const example = examples[i];
	test(`example ${i}`, (t) => {
		t.assert.snapshot(strip(example));
	});
}

const arb = {
	whitespace: () => fc.string({ unit: fc.constantFrom(" ", "\t") }),
	comment: {
		any: (content) =>
			fc.oneof(arb.comment.block(content), arb.comment.line(content)),
		block: (content) =>
			fc
				.record({
					content,
					pre: arb.whitespace(),
					start: arb.whitespace(),
					end: arb.whitespace(),
					post: arb.whitespace(),
				})
				.map(
					({ pre, start, content, end, post }) =>
						`${pre}/*${start}${content}${end}*/${post}`,
				),
		line: (content) =>
			fc
				.record({
					content,
					pre: arb.whitespace(),
					start: arb.whitespace(),
					end: arb.whitespace(),
				})
				.map(
					({ pre, start, content, end }) =>
						`${pre}//${start}${content}${end}\n`,
				),
	},
	directive: {
		eslint: () =>
			fc.oneof(
				arb.comment.block(fc.constantFrom("eslint-disable", "eslint-enable")),
				arb.comment.any(
					fc
						.record({
							directive: fc.constantFrom(
								"eslint-disable-line",
								"eslint-disable-next-line",
							),
							rules: fc.array(fc.stringMatching(/^ *[A-Za-z\-\/]+ *$/)),
						})
						.map(({ directive, rules }) => `${directive} ${rules.join(",")}`),
				),
			),
		typeCoverage: () =>
			arb.comment.any(
				fc
					.constantFrom("ignore-line", "ignore-next-line")
					.map((directive) => `type-coverage:${directive}`),
			),
	},
};

test("eslint", () => {
	fc.assert(
		fc.property(
			fc.record({
				pre: fc.string().map((s) => s.trimEnd()),
				directive: arb.directive.eslint(),
				post: fc.string().map((s) => s.trimStart()),
			}),
			({ pre, directive, post }) => {
				assert.match(
					strip(`${pre}${directive}${post}`),
					new RegExp(`${RegExp.escape(pre)}\n?${RegExp.escape(post)}`),
				);
			},
		),
	);
});

test("type-coverage", () => {
	fc.assert(
		fc.property(
			fc.record({
				pre: fc.string().map((s) => s.trimEnd()),
				directive: arb.directive.typeCoverage(),
				post: fc.string().map((s) => s.trimStart()),
			}),
			({ pre, directive, post }) => {
				assert.match(
					strip(`${pre}${directive}${post}`),
					new RegExp(`${RegExp.escape(pre)}\n?${RegExp.escape(post)}`),
				);
			},
		),
	);
});
