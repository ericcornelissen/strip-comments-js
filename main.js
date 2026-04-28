// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert";

const S_CODE = 0;
const S_LINE_COMMENT = 1;
const S_BLOCK_COMMENT = 2;
const S_STRING_SINGLE = 3;
const S_STRING_DOUBLE = 4;
const S_STRING_BACK = 5;

export function strip(code, options) {
	const { block, jsdoc, line, pattern, protected: protect } = options;
	if (!(pattern instanceof RegExp)) throw new Error("pattern must be a RegExp");

	const result = [];

	const chars = new Queue(code + "\n");
	const stack = new Stack(S_CODE);
	const comment = [];

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

					if (startLineComment || startBlockComment) comment.push(result.pop());
				}

				break;
			}
			case "*": {
				if (state === S_BLOCK_COMMENT && chars.peek() === "/") {
					if (comment.length > 2) {
						const content = comment.slice(2, comment.length - 1).join("");
						if (
							block &&
							(jsdoc || !content.startsWith("*")) &&
							(protect || !content.startsWith("!")) &&
							pattern.test(content)
						) {
							trimEnd(result);
							chars.next();
						} else {
							result.push(...comment);
						}

						stack.pop();
						comment.length = 0;
					}
				}

				break;
			}
			case "\n": {
				if (state === S_LINE_COMMENT) {
					const content = comment.slice(2, comment.length - 1).join("");
					if (
						line &&
						(protect || !content.startsWith("!")) &&
						pattern.test(content)
					) {
						trimEnd(result);
						if (chars.prev() === "\r") result.push("\r");
						result.push("\n");
					} else {
						result.push(...comment);
					}

					stack.pop();
					comment.length = 0;
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
			case "\\": {
				if (inString(state)) result.push(chars.next());
				break;
			}
		}
	}

	result.length--;
	return result.join("");
}

function inComment(state) {
	return state === S_LINE_COMMENT || state === S_BLOCK_COMMENT;
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
		const cur = result[i];
		if (/\s/.test(cur)) {
			result.pop();
		} else {
			break;
		}

		if (cur === "\n") {
			if (result[i - 1] === "\r") result.pop();
			break;
		}
	}
}

class Stack {
	#stack;

	constructor(init) {
		this.#stack = [init];
	}

	peek() {
		return this.#stack[this.#stack.length - 1];
	}

	pop() {
		this.#stack.pop();
		assert(this.#stack.length > 0);
	}

	push(state) {
		this.#stack.push(state);
	}
}

class Queue {
	#list;
	#idx;

	constructor(list) {
		this.#list = list;
		this.#idx = 0;
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
