// SPDX-License-Identifier: Apache-2.0

import { readFile, writeFile } from "node:fs/promises";

import { strip } from "./main.js";

const noop = () => {};

/**
 * Strip the directives from a string.
 *
 * @param {string} s The string to strip directives from.
 */
export function stripDirectives(s) {
	return strip(s);
}

/**
 * Strip the directives from a file on disk.
 *
 * @param {string} file The path of the file to strip directives from.
 */
export async function stripFileDirectives(file) {
	const debug = arguments[1] || noop;

	debug("reading '%s'", file);
	const content = await readFile(file, { encoding: "utf-8" });
	debug("stripping directives from '%s' (length: %d)", file, content.length);
	const stripped = stripDirectives(content);
	if (content !== stripped) {
		debug("writing stripped file '%s' (length: %d)", file, stripped.length);
		await writeFile(file, stripped, { encoding: "utf-8" });
	} else {
		debug("not writing '%s', identical after stripping", file);
	}
}

/**
 * Strip the directives from a collection of files on disk.
 *
 * @param {Iterable<string>} files The paths of the files to strip directives from.
 */
export async function stripFilesDirectives(files) {
	const debug = arguments[1] || noop;

	debug("received %d file(s) to strip", files.length);
	await Promise.all(files.map((file) => stripFileDirectives(file, debug)));
	debug("finished stripping");
}
