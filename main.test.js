// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert/strict";
import { test } from "node:test";

import * as fc from "fast-check";

import * as arb from "./arbitraries.js";

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

test("eslint", () => {
	fc.assert(
		fc.property(
			fc.record({
				pre: arb.javascript.program().map((s) => s.trimEnd()),
				directive: arb.directive.eslint(),
				post: arb.javascript.program().map((s) => s.trimStart()),
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
				pre: arb.javascript.program().map((s) => s.trimEnd()),
				directive: arb.directive.typeCoverage(),
				post: arb.javascript.program().map((s) => s.trimStart()),
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
