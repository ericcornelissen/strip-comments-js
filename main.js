// SPDX-License-Identifier: Apache-2.0

const S_CODE = 0;
const S_LINE_COMMENT = 1;
const S_BLOCK_COMMENT = 2;
const S_STRING_SINGLE = 3;
const S_STRING_DOUBLE = 4;
const S_STRING_BACK = 5;

export function strip(s) {
	const result = [];

	const chars = new Queue(s);
	const stack = new Stack(S_CODE);
	while (chars.peek() !== undefined) {
		const char = chars.next();
		const state = stack.peek();
		if (!inComment(state)) result.push(char);

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

					if (startLineComment || startBlockComment) {
						// Omit current '/'
						result.pop();

						// Remove leading whitespace
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
				}

				break;
			}
			case "*": {
				if (state === S_BLOCK_COMMENT && chars.peek() === "/") {
					stack.pop();
					chars.next();
				}

				break;
			}
			case "\n": {
				if (state === S_LINE_COMMENT) {
					stack.pop();
					if (chars.prev() === "\r") result.push("\r");
					result.push("\n");
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
					chars.next();
					result.push("{");
				}

				break;
			}
			case "\\": {
				if (inString(state)) result.push(chars.next());
				break;
			}
		}
	}

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
		return this.#list[this.#idx++];
	}

	peek() {
		return this.#list[this.#idx];
	}

	prev() {
		return this.#list[this.#idx - 2];
	}
}
