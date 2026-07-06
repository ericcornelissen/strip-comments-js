// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert";

const spdxExpr = /^ SPDX-License-Identifier: [A-Za-z0-9-.]+\s*$/;
const sourcemapExpr = /^# sourceMappingURL=/;
const whitespaceExpr =
	/[\t\f\v \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/;

/**
 * @typedef Options
 * @property {RegExp} pattern The pattern of comments to strip.
 * @property {boolean} block Whether to strip block comments.
 * @property {boolean} line Whether to strip line comments.
 * @property {boolean} jsdoc Whether to strip JSDoc comments.
 * @property {boolean} protected Whether to strip protected comments.
 * @property {boolean} sourcemap Whether to strip sourcemap comments.
 * @property {boolean} spdx Whether to strip SPDX short-form identifiers.
 */

/**
 * Strip comments from a piece of code.
 *
 * @param {string} code The code to strip comments from.
 * @param {Options} options The options for stripping.
 * @returns {string} The stripped code.
 * @throws If `options.pattern` is not a RegExp.
 */
export function strip(code, options) {
	const { pattern } = options;
	if (!(pattern instanceof RegExp)) throw new Error("pattern must be a RegExp");

	const result = new StringBuilder();
	const chars = new Scanner(code + "\n");

	if (!$code(chars, result, options, true)) return code;
	if (!chars.isEmpty()) return code;

	result.shrink();
	return result.toString();
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Options} options
 * @returns {boolean}
 */
function $blockComment(chars, result, options) {
	const { jsdoc, block, pattern, protected: protect } = options;

	const comment = new StringBuilder();
	comment.push(result.pop());
	comment.push(chars.next());

	while (chars.peek() !== undefined) {
		const char = chars.next();
		comment.push(char);

		if (char === "*" && chars.peek() === "/") {
			comment.push(chars.next());

			const content = comment
				.slice(2, comment.length - 2)
				.replaceAll(/[ \t]*\n[ \t]*\*/g, "");

			if (
				block &&
				(jsdoc || !content.startsWith("*")) &&
				(protect || !content.startsWith("!")) &&
				pattern.test(content)
			) {
				trimEnd(result);

				if (chars.peek() === "\n") {
					if (result.last() === "\n") result.shrink();
					if (result.last() === "\r") result.shrink();

					if (result.isEmpty()) {
						chars.next();
						if (chars.isEmpty()) result.push("\n");
					}
				}
			} else {
				result.push(...comment.chars());
			}

			return true;
		}
	}

	return false;
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Options} options
 * @param {boolean} [top]
 * @returns {boolean}
 */
function $code(chars, result, options, top = false) {
	while (chars.peek() !== undefined) {
		const char = chars.next();
		result.push(char);

		switch (char) {
			case "{": {
				if (!$code(chars, result, options)) return false;
				break;
			}
			case "}": {
				return true;
			}

			case "(": {
				const code = result.slice(0, -1);

				if (!$code(chars, result, options)) return false;

				if (/(^|[\s;})])(do|for|if|while)\s*$/.test(code)) {
					while (whitespaceExpr.test(chars.peek())) result.push(chars.next());

					const next = chars.peek();
					const nextnext = chars.peek(2);
					if (next === "/" && nextnext !== "/" && nextnext !== "*") {
						result.push(chars.next());
						if (!$regexp(chars, result)) return false;
					}
				}

				break;
			}
			case ")": {
				return true;
			}

			case "'":
			case '"': {
				if (!$string(chars, result, char)) return false;
				break;
			}
			case "`": {
				if (!$template(chars, result, options)) return false;
				break;
			}

			case "/": {
				const next = chars.peek();
				if (next === "/") {
					$lineComment(chars, result, options);
				} else if (next === "*") {
					if (!$blockComment(chars, result, options)) return false;
				} else if (startExpression(result)) {
					if (!$regexp(chars, result)) return false;
				}

				break;
			}
		}
	}

	return top;
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Options} options
 * @param {boolean} [multiline]
 */
function $lineComment(chars, result, options, multiline = false) {
	const { line, pattern, protected: protect, sourcemap, spdx } = options;

	const comment = new StringBuilder();
	comment.push(result.pop());

	while (chars.peek() !== undefined) {
		const char = chars.next();
		comment.push(char);
		if (char === "\n") break;
	}

	while (whitespaceExpr.test(chars.peek())) comment.push(chars.next());
	if (chars.peek() === "/" && chars.peek(2) === "/") {
		chars.next();
		comment.push(...$lineComment(chars, ["/"], options, true));
	}

	if (multiline) return comment.toString();

	const content = comment
		.slice(2, comment.length - 1)
		.replaceAll(/\r?\n[^\n/]*\/\/\s*/g, " ")
		.replace(/\r$/, "");
	if (
		line &&
		(protect || !content.startsWith("!")) &&
		(sourcemap || !sourcemapExpr.test(content)) &&
		(spdx || !spdxExpr.test(content)) &&
		pattern.test(content)
	) {
		trimEnd(result);

		if (result.last() === "\n") result.shrink();
		if (result.last() === "\r") result.shrink();

		if (!result.isEmpty() || chars.isEmpty()) {
			if (chars.prev() === "\r") result.push("\r");
			result.push("\n");
		}

		const trailing = comment.toString().split(/\r?\n/).at(-1);
		if (trailing.length > 0) result.push(...trailing);
	} else {
		result.push(...comment.chars());
	}
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @returns {boolean}
 */
function $regexp(chars, result) {
	let inCharRange = false;
	while (chars.peek() !== undefined) {
		const char = chars.next();
		result.push(char);

		switch (char) {
			case "\\": {
				result.push(chars.next());
				break;
			}
			case "[": {
				inCharRange = true;
				break;
			}
			case "]": {
				inCharRange = false;
				break;
			}
			case "/": {
				if (!inCharRange) return true;
			}
		}
	}

	return false;
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {"'" | '"'} quote
 * @returns {boolean}
 */
function $string(chars, result, quote) {
	while (chars.peek() !== undefined) {
		const char = chars.next();
		result.push(char);

		switch (char) {
			case "\\": {
				result.push(chars.next());
				break;
			}
			case quote: {
				return true;
			}
		}
	}

	return false;
}

/**
 * @param {Scanner} chars
 * @param {StringBuilder} result
 * @param {Options} options
 * @returns {boolean}
 */
function $template(chars, result, options) {
	while (chars.peek() !== undefined) {
		const char = chars.next();
		result.push(char);

		switch (char) {
			case "\\": {
				result.push(chars.next());
				break;
			}
			case "$": {
				if (chars.peek() === "{") {
					result.push(chars.next());
					$code(chars, result, options);
				}
				break;
			}
			case "`": {
				return true;
			}
		}
	}

	return false;
}

/**
 * @param {StringBuilder} snippet The program up to this point.
 * @returns {boolean} If this point in the program is the start of an expression.
 */
function startExpression(snippet) {
	const expressionExpr =
		/(^|\n|[~!%^&*(\-=+{[}|:;<,>?/])[\t\f\v \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$/;
	const keywordExpressionExpr =
		/(^|\s|[~!%^&*(\-=+{[}|:;<,>?/]|\))((await|delete|instanceof|typeof|void)\s*)+$/;
	const keywordStatementExpr = /(^|\s|[){};])(do|else|in|of|return)\s*$/;

	const s = snippet.slice(0, -1);
	return (
		expressionExpr.test(s) ||
		keywordExpressionExpr.test(s) ||
		keywordStatementExpr.test(s)
	);
}

/**
 * Strip (non-newline) whitespace at the end of a string builder.
 *
 * @param {StringBuilder} string The string the strip.
 */
function trimEnd(string) {
	for (let i = string.length - 1; i >= 0; i--) {
		const cur = string.get(i);
		if (whitespaceExpr.test(cur)) {
			string.shrink();
		} else {
			break;
		}
	}
}

/**
 * A one-way scanner over a list.
 *
 * @template T
 */
class Scanner {
	#list;
	#idx;

	/**
	 * Initialize a new scanner for a list.
	 *
	 * @param {T[]} list The list to create a scanner for.
	 */
	constructor(list) {
		this.#list = list;
		this.#idx = 0;
	}

	/**
	 * Check if the scanner is finished.
	 *
	 * @returns {boolean} `true` if the scanner finished, `false` otherwise.
	 */
	isEmpty() {
		return this.#list.length === this.#idx;
	}

	/**
	 * Consume the next element in the list.
	 *
	 * @returns {T} The next element.
	 * @throws {Error} The scanner is finished when called.
	 */
	next() {
		const idx = this.#idx++;
		assert(idx < this.#list.length);
		return this.#list[idx];
	}

	/**
	 * Preview the next element in the list without consuming it.
	 *
	 * @param {number} [n=1] How many characters to look ahead.
	 * @returns {T} The (nth) next element.
	 */
	peek(n = 1) {
		return this.#list[this.#idx + (n - 1)];
	}

	/**
	 * Inspect the previous element in the list.
	 *
	 * @returns {T} The previous element.
	 * @throws {Error} The scanner hasn't started yet when called.
	 */
	prev() {
		const idx = this.#idx - 2;
		assert(idx >= 0);
		return this.#list[idx];
	}
}

/**
 * A resizable string builder.
 */
class StringBuilder {
	#list;

	/**
	 * Initialize a new string builder.
	 */
	constructor() {
		this.#list = [];
	}

	/**
	 * The current length of the string being build.
	 */
	get length() {
		return this.#list.length;
	}

	/**
	 * Get the current string as a list of characters.
	 *
	 * @returns {string[]} The characters.
	 */
	chars() {
		return this.#list;
	}

	/**
	 * Get a character in the current string.
	 *
	 * @param {number} idx The index of the character to get.
	 * @returns {string} The character at `idx`.
	 * @throws {Error} if `idx` is out of range.
	 */
	get(idx) {
		assert(idx >= 0 && idx < this.#list.length);
		return this.#list[idx];
	}

	/**
	 * Check if the string builder is empty.
	 *
	 * @returns {boolean} `true` if the string builder is empty, `false` otherwise.
	 */
	isEmpty() {
		return this.#list.length === 0;
	}

	/**
	 * Get the last character in the current string.
	 *
	 * @returns {string} The last character.
	 */
	last() {
		return this.#list[this.#list.length - 1];
	}

	/**
	 * Add one or more characters to the string.
	 *
	 * @param {...string} chars The character(s) to add.
	 * @throws {Error} No characters have been provided.
	 * @throws {Error} At least one of `chars` is not a string.
	 * @throws {Error} At least one of `chars` is not a character.
	 */
	push(...chars) {
		assert(chars.length > 0);
		assert(chars.every((char) => typeof char === "string"));
		assert(chars.every((char) => char.length === 1));
		this.#list.push(...chars);
	}

	/**
	 * Remove the last character from the current string.
	 *
	 * @returns {string} The last character in the string.
	 * @throws {Error} The current string is empty.
	 */
	pop() {
		assert(this.#list.length > 0);
		return this.#list.pop();
	}

	/**
	 * Reset the string builder to an empty string.
	 */
	reset() {
		this.#list.length = 0;
	}

	/**
	 * Shrink the current string by 1.
	 *
	 * @throws {Error} The current string is empty.
	 */
	shrink() {
		assert(this.#list.length > 0);
		this.#list.length -= 1;
	}

	/**
	 * Extract a slice of the current string.
	 *
	 * If `end` is negative, it is relative to the end of the string.
	 *
	 * @param {number} start The start index of the slice.
	 * @param {number} end The end index of the slice.
	 * @returns {string} The substring from `start` to `end`.
	 * @throws {Error} Either `start` or `end` is out of bounds.
	 */
	slice(start, end) {
		assert(start >= 0 && end < this.#list.length);
		return this.#list.slice(start, end).join("");
	}

	/**
	 * Extract the current string from the builder.
	 *
	 * @returns {string} The current string.
	 */
	toString() {
		return this.#list.join("");
	}
}
