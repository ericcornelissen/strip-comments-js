// SPDX-License-Identifier: Apache-2.0

import { strip } from "./main.js";

/**
 * Strip the comments from a string.
 *
 * @param {string} s The string to strip comments from.
 */
export function stripComments(s) {
	return strip(s);
}
