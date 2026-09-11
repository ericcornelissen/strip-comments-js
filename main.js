// SPDX-License-Identifier: Apache-2.0

import { process } from "psychic-doodle";

const jsdocLicenseExpr = /[\s*]@license\s+[\-.0-9A-Za-z]+\s*(?:\*|$)/m;
const licenseHeaderExpr = /^!?\s*Copyright \(C\) \d+(?:-\d+)?\s/;
const spdxExpr = /^ SPDX-License-Identifier: [\-.0-9A-Za-z]+\s*$/;
const sourcemapExpr = /^# sourceMappingURL=/;

/**
 * @typedef Options
 * @property {boolean} atlicense
 * @property {boolean} block
 * @property {boolean} licenseHeader
 * @property {boolean} line
 * @property {boolean} jsdoc
 * @property {RegExp} pattern
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
 * @throws {Error} If `code` is invalid.
 * @throws {TypeError} If `options.pattern` is not a RegExp.
 * @throws {RangeError} If `code` has too deeply nested constructs.
 */
export function strip(code, options) {
	const { pattern } = options;
	if (!(pattern instanceof RegExp)) {
		throw new TypeError("pattern must be a RegExp");
	}

	const hooks = {
		blockComment: onBlockComment(options),
		lineComment: onLineComment(options),
	};

	return process(code, hooks);
}

/**
 * @param {Options} options
 * @returns {(comment: string) => string}
 */
function onBlockComment(options) {
	const {
		atlicense: jsdocLicense,
		block,
		jsdoc,
		licenseHeader,
		pattern,
		protected: protect,
	} = options;

	return (comment) => {
		let content = comment.slice(2, comment.length - 2);

		const isJsdoc = content.startsWith("*");
		const isJsdocLicense = isJsdoc && jsdocLicenseExpr.test(content);
		const isProtected = content.startsWith("!");
		const isLicenseHeader = licenseHeaderExpr.test(content);

		content = content
			.replace(/^[!*]/, "")
			.replaceAll(/(?<=^|[^\t ])[\t ]*\n[\t ]*\*?[\t ]*/g, " ")
			.replaceAll(/^[\t ]*(?![\t ])|(?<![\t ])[\t ]*$/g, "");
		const matched = pattern.test(content);

		if (
			matched &&
			((block &&
				!isJsdoc &&
				!isJsdocLicense &&
				!isLicenseHeader &&
				(protect || !isProtected)) ||
				(jsdoc && isJsdoc && !isJsdocLicense) ||
				(jsdocLicense && isJsdocLicense) ||
				(licenseHeader && isLicenseHeader))
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
