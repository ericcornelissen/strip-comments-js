// SPDX-License-Identifier: Apache-2.0

import { strip } from "./main.js";

/**
 * Strip the comments from a string.
 *
 * @param {string} code The code to strip comments from.
 * @param {RegExp} [expr] The pattern of comments to strip.
 */
export function stripComments(code, expr) {
	return strip(code, expr);
}
