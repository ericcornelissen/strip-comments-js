// SPDX-License-Identifier: Apache-2.0

import { readFile, writeFile } from "node:fs/promises";

import { strip } from "./main.js";

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
	const content = await readFile(file, { encoding: "utf-8" });
	const stripped = stripDirectives(content);
	await writeFile(file, stripped, { encoding: "utf-8" });
}

/**
 * Strip the directives from a collection of files on disk.
 *
 * @param {Iterable<string>} files The paths of the files to strip directives from.
 */
export async function stripFilesDirectives(files) {
	await Promise.all(files.map(stripFileDirectives));
}
