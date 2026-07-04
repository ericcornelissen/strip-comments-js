// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert";

const S_CODE = 0;
const S_LINE_COMMENT = 1;
const S_BLOCK_COMMENT = 2;
const S_STRING_SINGLE = 3;
const S_STRING_DOUBLE = 4;
const S_STRING_BACK = 5;
const S_REGEXP = 6;
const S_REGEXP_CHAR_RANGE = 7;
const S_CONTROL_FLOW_START = 8;
const S_CONTROL_FLOW_BODY = 9;

const spdxExpr = /^ SPDX-License-Identifier: [A-Za-z0-9-.]+\s*$/;
const whitespaceExpr =
	/[\t\f\v \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/;

/**
 * @typedef Options
 * @property {RegExp} pattern The pattern of comments to strip.
 * @property {boolean} block Whether to strip block comments.
 * @property {boolean} line Whether to strip line comments.
 * @property {boolean} jsdoc Whether to strip JSDoc comments.
 * @property {boolean} protected Whether to strip protected comments.
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
	const { block, jsdoc, line, pattern, protected: protect, spdx } = options;
	if (!(pattern instanceof RegExp)) throw new Error("pattern must be a RegExp");

	const result = new StringBuilder();
	const chars = new Scanner(code + "\n");
	const stack = new Stack(S_CODE);
	const comment = new StringBuilder();

	while (chars.peek() !== undefined) {
		const char = chars.next();
		const state = stack.peek();

		if (!inComment(state)) result.push(char);
		else comment.push(char);

		if (whitespaceExpr.test(char)) continue;
		if (state === S_CONTROL_FLOW_BODY) stack.pop();

		switch (char) {
			case "{": {
				if (inCode(state)) stack.push(S_CODE);
				break;
			}
			case "}": {
				if (inCode(state)) stack.pop();
				break;
			}
			case "(": {
				if (inCode(state)) stack.push(S_CODE);
				break;
			}
			case ")": {
				if (inCode(state)) stack.pop();

				if (stack.peek() === S_CONTROL_FLOW_START) {
					stack.pop();
					stack.push(S_CONTROL_FLOW_BODY);
				}

				break;
			}

			// Comments
			case "/": {
				if (inCode(state)) {
					const next = chars.peek();

					const startLineComment = next === "/";
					const startBlockComment = next === "*";

					if (startLineComment) stack.push(S_LINE_COMMENT);
					else if (startBlockComment) stack.push(S_BLOCK_COMMENT);
					else if (startExpression(state, result)) stack.push(S_REGEXP);

					if (startLineComment || startBlockComment) comment.push(result.pop());
				} else if (state === S_REGEXP) {
					stack.pop();
				}

				break;
			}
			case "*": {
				if (state === S_BLOCK_COMMENT && chars.peek() === "/") {
					if (comment.length > 2) {
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

						stack.pop();
						comment.reset();
					}
				}

				break;
			}
			case "\n": {
				if (state === S_LINE_COMMENT) {
					let content = comment.slice(2, comment.length - 1);
					if (content.endsWith("\r")) content = content.slice(0, -1);

					if (
						line &&
						(protect || !content.startsWith("!")) &&
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
					} else {
						result.push(...comment.chars());
					}

					stack.pop();
					comment.reset();
				}

				break;
			}

			// Control flow
			case "e":
			case "f":
			case "o":
			case "r": {
				if (inCode(state)) {
					const code = result.slice(0, -1) + char;
					if (/(^|[\s;})])(while|if|do|for)$/.test(code)) {
						const peek = chars.peek();
						if (peek === "(" || whitespaceExpr.test(peek)) {
							stack.push(S_CONTROL_FLOW_START);
						}
					}
				}

				break;
			}

			// Strings
			case "'": {
				if (inCode(state)) stack.push(S_STRING_SINGLE);
				else if (state === S_STRING_SINGLE) stack.pop();
				break;
			}
			case '"': {
				if (inCode(state)) stack.push(S_STRING_DOUBLE);
				else if (state === S_STRING_DOUBLE) stack.pop();
				break;
			}
			case "`": {
				if (inCode(state)) stack.push(S_STRING_BACK);
				else if (state === S_STRING_BACK) stack.pop();
				break;
			}
			case "$": {
				if (state === S_STRING_BACK && chars.peek() === "{") {
					stack.push(S_CODE);
					result.push(chars.next());
				}

				break;
			}

			// Regular Expressions
			case "[": {
				if (state === S_REGEXP) stack.push(S_REGEXP_CHAR_RANGE);
				break;
			}
			case "]": {
				if (state === S_REGEXP_CHAR_RANGE) stack.pop();
				break;
			}

			// Escaping
			case "\\": {
				if (inString(state) || inRegExp(state)) result.push(chars.next());
				break;
			}
		}
	}

	result.shrink();
	return result.toString();
}

/**
 * Check if we are currently in code.
 *
 * @param {number} state The current state.
 * @returns {boolean} If `state` is one of the code states.
 */
function inCode(state) {
	return (
		state === S_CODE ||
		state === S_CONTROL_FLOW_START ||
		state === S_CONTROL_FLOW_BODY
	);
}

/**
 * Check if we are currently in a code comment.
 *
 * @param {number} state The current state.
 * @returns {boolean} If `state` is one of the comment states.
 */
function inComment(state) {
	return state === S_LINE_COMMENT || state === S_BLOCK_COMMENT;
}

/**
 * Check if we are currently in a regular expression literal.
 *
 * @param {number} state The current state.
 * @returns {boolean} If `state` is one of the regexp states.
 */
function inRegExp(state) {
	return state === S_REGEXP || state === S_REGEXP_CHAR_RANGE;
}

/**
 * Check if we are currently in a string literal.
 *
 * @param {number} state The current state.
 * @returns {boolean} If `state` is one of the string states.
 */
function inString(state) {
	return (
		state === S_STRING_SINGLE ||
		state === S_STRING_DOUBLE ||
		state === S_STRING_BACK
	);
}

/**
 *
 * @param {number} state The current state.
 * @param {StringBuilder} snippet The program up to this point.
 * @returns {boolean} If `state` is one of the string states.
 */
function startExpression(state, snippet) {
	const s = snippet.slice(0, -1);
	return (
		/(^|[([{};\n:,=+!>\-])\s*$/.test(s) ||
		/(^|[\s){};])(in|of|return)\s*$/.test(s) ||
		/}\s*else\s*$/.test(s) ||
		/(^|[()[{};:,=+!>\-\s])(delete|void)(\s+(delete|void))*\s*$/.test(s) ||
		/\*\/\s*$/.test(s) ||
		state === S_CONTROL_FLOW_BODY
	);
}

/**
 * Strip (non-newline) whitespace at the end of a string builder.
 *
 * @param {StringBuilder} string The string the strip.
 */
function trimEnd(string) {
	for (let i = string.length - 1; i > 0; i--) {
		const cur = string.get(i);
		if (whitespaceExpr.test(cur)) {
			string.shrink();
		} else {
			break;
		}
	}
}

/**
 * A LIFO stack that may not be empty.
 *
 * @template T
 */
class Stack {
	#stack;

	/**
	 * Initialize a new stack with one (mandatory) element, which can never be
	 * removed.
	 *
	 * @param {T} base The initial element on the stack.
	 */
	constructor(base) {
		this.#stack = [base];
	}

	/**
	 * Inspect the top of the stack without consuming it.
	 *
	 * @returns {T} The top element
	 */
	peek() {
		return this.#stack[this.#stack.length - 1];
	}

	/**
	 * Remote the top of the stack.
	 *
	 * @throws {Error} Te stack has only one element when called.
	 */
	pop() {
		this.#stack.length -= 1;
		assert(this.#stack.length > 0);
	}

	/**
	 * Add a new element to the top of the stack.
	 *
	 * @param {T} element The element to put on top of the stack.
	 */
	push(element) {
		this.#stack.push(element);
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
	 * Consume the current element in the list.
	 *
	 * @returns {T} The current element.
	 * @throws {Error} The scanner is finished when called.
	 */
	next() {
		const idx = this.#idx++;
		assert(idx < this.#list.length);
		return this.#list[idx];
	}

	/**
	 * Preview the current element in the list without consuming it.
	 *
	 * @returns {T} The current element.
	 */
	peek() {
		return this.#list[this.#idx];
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
