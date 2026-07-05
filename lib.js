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
 * @property {boolean} [sourcemap=true] Whether to strip sourcemap comments.
 * @property {boolean} [spdx=false] Whether to strip SPDX short-form identifiers.
 */

/**
 * Strip comments from a piece of code.
 *
 * @param {string} code The code to strip comments from.
 * @param {Options | RegExp} [options] The options for stripping.
 * @return {string} The stripped code.
 * @throws If pattern is not a RegExp.
 */
export function stripComments(code, options) {
	if (options instanceof RegExp) options = { pattern: options };

	if (options === undefined) options = {};
	options.pattern ??= any;
	options.block ??= true;
	options.jsdoc ??= true;
	options.line ??= true;
	options.protected ??= true;
	options.sourcemap ??= true;
	options.spdx ??= false;

	return strip(code, options);
}
