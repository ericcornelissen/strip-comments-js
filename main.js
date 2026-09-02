// SPDX-License-Identifier: Apache-2.0

import assert from "node:assert";

const licenseHeaderExpr = /^!?\s*Copyright \(C\) \d+(?:-\d+)?\s/;
const spdxExpr = /^ SPDX-License-Identifier: [\-.0-9A-Za-z]+\s*$/;
const sourcemapExpr = /^# sourceMappingURL=/;
const whitespaceExpr =
	/[\t\v\f \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/;

/**
 * @typedef Options
 * @property {RegExp} pattern
 * @property {boolean} block
 * @property {boolean} licenseHeader
 * @property {boolean} line
 * @property {boolean} jsdoc
 * @property {boolean} protected
 * @property {boolean} sourcemap
 * @property {boolean} spdx
 */

/**
 * @typedef Hooks
 * @property {(comment: string) => string} blockComment
 * @property {(comment: string) => string} lineComment
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

	const hooks = {
		blockComment: onBlockComment(options),
		lineComment: onLineComment(options),
	};

	try {
		return process(code, hooks);
	} catch {
		return code;
	}
}

/**
 * @param {Options} options
 * @returns {(comment: string) => string}
 */
function onBlockComment(options) {
	const { block, jsdoc, licenseHeader, pattern, protected: protect } = options;

	return (comment) => {
		let content = comment.slice(2, comment.length - 2);

		const isJsdoc = content.startsWith("*");
		const isProtected = content.startsWith("!");
		const isLicenseHeader = licenseHeaderExpr.test(content);

		content = content
			.replace(/^[!*]/, "")
			.replaceAll(/(?<=^|[^\t ])[\t ]*\n[\t ]*\*?[\t ]*/g, " ")
			.replaceAll(/^[\t ]*(?![\t ])|(?<![\t ])[\t ]*$/g, "");
		const matched = pattern.test(content);

		if (
			(block &&
				!isJsdoc &&
				!isLicenseHeader &&
				(protect || !isProtected) &&
				matched) ||
			(jsdoc && isJsdoc && matched) ||
			(licenseHeader && isLicenseHeader && matched)
		) {
			return "";
		} else {
			return comment;
		}
	};
}

/**
 * @param {Options} options
 * @returns {(comment: string) => string}
 */
function onLineComment(options) {
	const tDefault = 0,
		tLicenseHeader = 4,
		tLicenseHeaderP = 5,
		tProtected = 1,
		tSourcemap = 2,
		tSpdx = 3;

	const {
		licenseHeader,
		line,
		pattern,
		protected: protect,
		sourcemap,
		spdx,
	} = options;

	return (comment) => {
		const lines = comment.split(/(\r?\n)/);
		const segments = [];
		let current = { value: "", type: tDefault };
		for (const line of lines) {
			if (line === "\n" || line === "\r\n") {
				current.value += line;
				continue;
			}

			const content = line.replaceAll(/^\s*\/\//g, "");

			if (licenseHeaderExpr.test(content)) {
				segments.push(current);
				current = {
					value: line,
					type: content.startsWith("!") ? tLicenseHeaderP : tLicenseHeader,
				};
			} else if (sourcemapExpr.test(content)) {
				segments.push(current);
				current = { value: line, type: tSourcemap };
			} else if (spdxExpr.test(content)) {
				segments.push(current);
				current = { value: line, type: tSpdx };
			} else if (content.startsWith("!")) {
				if (current.type === tProtected || current.type === tLicenseHeaderP) {
					current.value += line;
				} else {
					segments.push(current);
					current = { value: line, type: tProtected };
				}
			} else {
				if (current.type === tDefault || current.type === tLicenseHeader) {
					current.value += line;
				} else {
					segments.push(current);
					current = { value: line, type: tDefault };
				}
			}
		}
		segments.push(current);

		let result = "";
		for (const segment of segments) {
			const content = segment.value
				.replaceAll(/(^|\r?\n[^\n/]*)\/\/!?\s*/g, " ")
				.replace(/\r?\n/, "");
			const matched = pattern.test(content);

			if (!(
				(line &&
					segment.type !== tLicenseHeader &&
					segment.type !== tLicenseHeaderP &&
					(protect || segment.type !== tProtected) &&
					segment.type !== tSourcemap &&
					segment.type !== tSpdx &&
					matched) ||
				(licenseHeader &&
					(segment.type === tLicenseHeader ||
						segment.type === tLicenseHeaderP) &&
					matched) ||
				(sourcemap && segment.type === tSourcemap && matched) ||
				(spdx && segment.type === tSpdx && matched)
			)) {
				result += segment.value;
			}
		}

		return result;
	};
}

/**
 * @param {string} code
 * @param {Hooks} hooks
 * @returns {string}
 */
function process(code, hooks) {
	const result = new StringBuilder();
	const chars = new Scanner(code + "\n");
	$code(chars, result, hooks, null);
	result.shrink();
	return result.toString();
}

/**
 * @param {Scanner<string>} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws
 */
function $blockComment(chars, result, hooks) {
	const comment = new StringBuilder();
	comment.push(result.pop());
	comment.push(chars.next());

	let char;
	while ((char = chars.next()) !== null) {
		comment.push(char);

		if (char === "*" && chars.peek() === "/") {
			comment.push(chars.next());

			const rawComment = comment.toString();
			const outComment = hooks.blockComment(rawComment);
			if (outComment.length === 0) {
				trimEnd(result);

				if (chars.peek() === "\n" || chars.peek(2) === "\r\n") {
					if (result.last() === "\n") result.shrink();
					if (result.last() === "\r") result.shrink();

					if (result.isEmpty()) {
						if (chars.next() === "\r") chars.next();
						if (chars.isEmpty()) result.push("\n");
					}
				}
			} else {
				result.push(...outComment);
			}

			return;
		}
	}

	throw new Error("unclosed block");
}

/**
 * @param {Scanner<string>} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @param {"{" | "(" | null} match
 * @throws
 */
function $code(chars, result, hooks, match) {
	let char;
	while ((char = chars.next()) !== null) {
		result.push(char);

		switch (char) {
			case "{": {
				$code(chars, result, hooks, "{");
				break;
			}
			case "}": {
				if (match !== "{") {
					throw new Error(`unmatched '}' (expected '${match}')`);
				}

				return;
			}

			case "(": {
				const code = result.slice(0, -1);

				$code(chars, result, hooks, "(");
				if (/(?:^|[\s);{}])(?:do|for|if|while|with)\s*$/.test(code)) {
					$whitespace(chars, result);

					const next = chars.peek(2);
					if (next[0] === "/" && next[1] !== "/" && next[1] !== "*") {
						result.push(chars.next());
						$regexp(chars, result);

						$whitespace(chars, result);
						const next = chars.peek(2);
						if (next[0] === "/" && next[1] !== "/" && next[1] !== "*") {
							result.push(chars.next());
						}
					}
				}

				break;
			}
			case ")": {
				if (match !== "(") {
					throw new Error(`unmatched ')' (expected '${match}')`);
				}

				return;
			}

			case "'":
			case '"': {
				$string(chars, result, char);
				break;
			}
			case "`": {
				$template(chars, result, hooks);
				break;
			}

			case "/": {
				const next = chars.peek();
				if (next === "/") {
					$lineComment(chars, result, hooks);
				} else if (next === "*") {
					$blockComment(chars, result, hooks);
				} else if (startExpression(result)) {
					$regexp(chars, result);

					$whitespace(chars, result);
					const next = chars.peek(2);
					if (next[0] === "/" && next[1] !== "/" && next[1] !== "*") {
						result.push(chars.next());
					}
				}

				break;
			}
		}
	}

	if (match !== null) {
		throw new Error(`unmatched '${match}'`);
	}
}

/**
 * @param {Scanner<string>} chars
 * @param {StringBuilder} result
 * @param {Options} options
 */
function $lineComment(chars, result, hooks) {
	const comment = new StringBuilder();
	comment.push(result.pop());

	const whitespace = new StringBuilder();
	let char;
	while ((char = chars.next()) !== null) {
		comment.push(char);
		if (char === "\n") {
			$whitespace(chars, whitespace);

			if (chars.peek(2) === "//") {
				if (!whitespace.isEmpty()) {
					comment.push(...whitespace.chars());
					whitespace.clear();
				}
			} else {
				break;
			}
		}
	}

	const rawComment = comment.toString();
	const outComment = hooks.lineComment(rawComment);
	if (outComment.length === 0) {
		trimEnd(result);

		if (result.last() === "\n") result.shrink();
		if (result.last() === "\r") result.shrink();

		if (!result.isEmpty() || chars.isEmpty()) {
			if (chars.prev() === "\r") result.push("\r");
			result.push("\n");
		}
	} else {
		result.push(...outComment);
	}

	if (!whitespace.isEmpty()) result.push(...whitespace.chars());
}

/**
 * @param {Scanner<string>} chars
 * @param {StringBuilder} result
 * @throws
 */
function $regexp(chars, result) {
	let inCharRange = false;
	let char;
	while ((char = chars.next()) !== null) {
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
				if (!inCharRange) return;
			}
		}
	}

	throw new Error("unclosed regular expression literal");
}

/**
 * @param {Scanner<string>} chars
 * @param {StringBuilder} result
 * @param {"'" | '"'} quote
 * @throws
 */
function $string(chars, result, quote) {
	let char;
	while ((char = chars.next()) !== null) {
		result.push(char);

		switch (char) {
			case "\\": {
				result.push(chars.next());
				break;
			}
			case quote: {
				return;
			}
		}
	}

	throw new Error("unclosed string literal");
}

/**
 * @param {Scanner<string>} chars
 * @param {StringBuilder} result
 * @param {Hooks} hooks
 * @throws
 */
function $template(chars, result, hooks) {
	let char;
	while ((char = chars.next()) !== null) {
		result.push(char);

		switch (char) {
			case "\\": {
				result.push(chars.next());
				break;
			}
			case "$": {
				if (chars.peek() === "{") {
					result.push(chars.next());
					$code(chars, result, hooks, "{");
				}
				break;
			}
			case "`": {
				return;
			}
		}
	}

	throw new Error("unclosed template literal");
}

/**
 * @param {Scanner<string>} chars
 * @param {StringBuilder} result
 * @returns {string | null}
 */
function $whitespace(chars, result) {
	let char;
	while ((char = chars.next()) !== null) {
		if (whitespaceExpr.test(char)) {
			result.push(char);
		} else {
			break;
		}
	}

	chars.undo();
}

/**
 * @param {StringBuilder} snippet The program up to this point.
 * @returns {boolean} If this point in the program is the start of an expression.
 */
function startExpression(snippet) {
	const expressionExpr =
		/(?:^|[\n!%&(*+,\-/:;<=>?[^{|}~])[\t\v\f \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$/;
	const keywordExpressionExpr =
		/(?:^|[\s!%&()*+,\-/:;<=>?[^{|}~])(?:await|default|delete|instanceof|new|throw|typeof|void|yield)\s*$/;
	const keywordStatementExpr = /(?:^|[\s);{}])(?:do|else|in|of|return)\s*$/;

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
	 * Consume the next element.
	 *
	 * @returns {T | null} The next element, or null if the scanner finished.
	 */
	next() {
		const idx = this.#idx++;
		return this.#list[idx] || null;
	}

	/**
	 * Preview the next n elements
	 *
	 * @param {number} [n=1] How many characters to look ahead.
	 * @returns {T} The next (up-to) n elements.
	 * @throws {Error} The requested number of elements is less than 1.
	 */
	peek(n = 1) {
		assert(n > 0);
		return this.#list.slice(this.#idx, this.#idx + n);
	}

	/**
	 * Inspect the previous element in the list.
	 *
	 * @returns {T} The previous element.
	 * @throws {Error} The current scanner position is 0.
	 */
	prev() {
		const idx = this.#idx - 2;
		assert(idx >= 0);
		return this.#list[idx];
	}

	/**
	 * Undo the last call of next.
	 *
	 * @throws {Error} The current scanner position is 0.
	 */
	undo() {
		assert(this.#idx > 0);
		this.#idx -= 1;
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
	 * Reset the underlying string to the empty string.
	 */
	clear() {
		this.#list.length = 0;
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
