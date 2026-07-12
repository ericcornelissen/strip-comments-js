// SPDX-License-Identifier: Apache-2.0

import { readdir, readFile, writeFile } from "node:fs/promises";
import * as path from "node:path";

export async function files() {
	const files = {};
	for (const filename of await readdir("testdata")) {
		const id = filename.replace(/\.\w+$/, ".js");
		files[id] ??= {
			name: id,
			flags: [],
			[Symbol.dispose]() {
				writeFile(this.filepath, this.original);
			},
		};

		const filepath = path.resolve("testdata", filename);
		const content = await readFile(filepath, { encoding: "utf-8" });
		if (filename.endsWith(".js") || filename.endsWith(".ts")) {
			files[id].filepath = filepath;
			files[id].original = content;
		} else if (filename.endsWith(".want")) {
			files[id].want = content;
		} else if (filename.endsWith(".opts")) {
			const { flags, options } = JSON.parse(content);
			options.pattern = new RegExp(options.pattern);

			files[id].flags = flags;
			files[id].options = options;
		} else {
			throw new Error(`Unexpected file: ${filename}`);
		}
	}

	return Object.values(files);
}
