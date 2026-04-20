// SPDX-License-Identifier: Apache-2.0

import { strip } from "./main.js";

/**
 * Strip the comments from a string.
 *
 * @param {string} s The string to strip comments from.
 * @param {RegExp} [expr] The pattern of comments to strip.
 */
export function stripComments(s, expr) {
	return strip(s, expr);
}
