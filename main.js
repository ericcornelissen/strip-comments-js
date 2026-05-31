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

const spdxExpr = /^ SPDX-License-Identifier: [A-Za-z0-9-.]+\s*$/;
const whitespaceExpr =
	/[\t\f\v \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/;

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

		switch (char) {
			case "{": {
				if (state === S_CODE) stack.push(S_CODE);
				break;
			}
			case "}": {
				if (state === S_CODE) stack.pop();
				break;
			}

			// Comments
			case "/": {
				if (state === S_CODE) {
					const next = chars.peek();

					const startLineComment = next === "/";
					const startBlockComment = next === "*";

					if (startLineComment) stack.push(S_LINE_COMMENT);
					else if (startBlockComment) stack.push(S_BLOCK_COMMENT);
					else {
						const code = result.slice(0, -1);
						if (/(^|[(;=\n!>])\s*$/.test(code)) stack.push(S_REGEXP);
					}

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

						const content = comment.slice(2, comment.length - 2);
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

			// Strings
			case "'": {
				if (state === S_CODE) stack.push(S_STRING_SINGLE);
				else if (state === S_STRING_SINGLE) stack.pop();
				break;
			}
			case '"': {
				if (state === S_CODE) stack.push(S_STRING_DOUBLE);
				else if (state === S_STRING_DOUBLE) stack.pop();
				break;
			}
			case "`": {
				if (state === S_CODE) stack.push(S_STRING_BACK);
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

function inComment(state) {
	return state === S_LINE_COMMENT || state === S_BLOCK_COMMENT;
}

function inRegExp(state) {
	return state === S_REGEXP || state === S_REGEXP_CHAR_RANGE;
}

function inString(state) {
	return (
		state === S_STRING_SINGLE ||
		state === S_STRING_DOUBLE ||
		state === S_STRING_BACK
	);
}

function trimEnd(result) {
	for (let i = result.length - 1; i > 0; i--) {
		const cur = result.get(i);
		if (whitespaceExpr.test(cur)) {
			result.shrink();
		} else {
			break;
		}
	}
}

class Stack {
	#stack;

	constructor(base) {
		this.#stack = [base];
	}

	peek() {
		return this.#stack[this.#stack.length - 1];
	}

	pop() {
		this.#stack.length -= 1;
		assert(this.#stack.length > 0);
	}

	push(state) {
		this.#stack.push(state);
	}
}

class Scanner {
	#list;
	#idx;

	constructor(list) {
		this.#list = list;
		this.#idx = 0;
	}

	isEmpty() {
		return this.#list.length === this.#idx;
	}

	next() {
		const idx = this.#idx++;
		assert(idx < this.#list.length);
		return this.#list[idx];
	}

	peek() {
		return this.#list[this.#idx];
	}

	prev() {
		const idx = this.#idx - 2;
		assert(idx >= 0);
		return this.#list[idx];
	}
}

class StringBuilder {
	#list;

	constructor() {
		this.#list = [];
	}

	get length() {
		return this.#list.length;
	}

	chars() {
		return this.#list;
	}

	get(idx) {
		assert(idx >= 0 && idx < this.#list.length);
		return this.#list[idx];
	}

	isEmpty() {
		return this.#list.length === 0;
	}

	last() {
		return this.#list[this.#list.length - 1];
	}

	push(...chars) {
		assert(chars.length > 0);
		assert(chars.every((char) => typeof char === "string"));
		assert(chars.every((char) => char.length === 1));
		this.#list.push(...chars);
	}

	pop() {
		assert(this.#list.length >= 0);
		return this.#list.pop();
	}

	reset() {
		this.#list.length = 0;
	}

	shrink() {
		this.#list.length -= 1;
		assert(this.#list.length >= 0);
	}

	slice(start, end) {
		assert(start >= 0);
		assert(end < this.#list.length);
		return this.#list.slice(start, end).join("");
	}

	toString() {
		return this.#list.join("");
	}
}
