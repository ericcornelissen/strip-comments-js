// SPDX-License-Identifier: Apache-2.0

import { strip } from "./main.js";

const any = /[^]?/;

/**
 * @typedef Options
 * @property {RegExp} [pattern] The pattern of comments to strip.
 * @property {boolean} [block=true] Whether to strip block comments.
 * @property {boolean} [line=true] Whether to strip line comments.
 * @property {boolean} [jsdoc=true] Whether to strip JSDoc comments.
 * @property {boolean} [protected=true] Whether to strip protected comments.
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
	options.protected ??= true;

	return strip(code, options);
}
