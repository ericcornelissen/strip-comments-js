// SPDX-License-Identifier: Apache-2.0

import { strip } from "./main.js";

const any = /[^]?/;

/**
 * @typedef Options
 * @property {RegExp} [pattern] The pattern of comments to strip.
 * @property {true} [block=true] Whether to strip block comments.
 * @property {true} [line=true] Whether to strip line comments.
 * @property {true} [jsdoc=true] Whether to strip JSDoc comments.
 */

/**
 * Strip the comments from a string.
 *
 * @param {string} code The code to strip comments from.
 * @param {Options | RegExp} [options] The pattern of comments to strip.
 */
export function stripComments(code, options) {
	if (options instanceof RegExp) options = { pattern: options };

	if (options === undefined) options = {};
	options.pattern ??= any;
	options.block ??= true;
	options.jsdoc ??= true;
	options.line ??= true;

	return strip(code, options);
}
