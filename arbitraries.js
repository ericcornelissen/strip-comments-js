// SPDX-License-Identifier: Apache-2.0

import * as fc from "fast-check";

import { javascript } from "@ericcornelissen/arbitrary-javascript";

export function codeWithComment(type) {
	return fc
		.record({
			pre: javascript(),
			comment: commentArbitrary(type),
			post: javascript(),
			options: options(),
		})
		.map(({ pre, comment, post, options }) => {
			if (/^\s*\/\*/.test(comment) && !/;\s$/.test(pre)) {
				pre += ";";
			}

			const code = `${pre}${comment}${post}`;
			return { code, comment, options };
		});
}

function commentArbitrary(type) {
	switch (type) {
		case "block":
			return javascript.comment.block();
		case "jsdoc":
			return javascript.comment
				.block()
				.map((s) => s.replace(/^(\s*)\/\*/, "$1/**"))
				.filter((s) => !/^(\s*)\/\*\*\//.test(s));
		case "line":
			return javascript.comment.line();
		case "non-jsdoc":
			return javascript.comment.block().filter((s) => !/^\s*\/\*\*/.test(s));
		case "non-protected":
			return javascript.comment().filter((s) => !/^\s*\/[/*]!/.test(s));
		case "non-spdx":
			return javascript
				.comment()
				.filter((s) => !/\s*\/\/ SPDX-License-Identifier: /.test(s));
		case "protected":
			return javascript
				.comment()
				.map((s) => s.replace(/^(\s*)(\/[/*])/, "$1$2!"));
		case "spdx":
			return javascript.comment
				.line({
					content: fc
						.stringMatching(/^[A-Za-z0-9-]+$/)
						.map((s) => `SPDX-License-Identifier: ${s}`),
				})
				.map((s) => s.replace(/\/\/\s*/, "// "));
		default:
			return javascript.comment();
	}
}

export function options() {
	return fc
		.record({
			block: fc.boolean(),
			jsdoc: fc.boolean(),
			line: fc.boolean(),
			protected: fc.boolean(),
			spdx: fc.boolean(),
		})
		.map((options) => {
			options.pattern = /[^]?/;
			return options;
		});
}
