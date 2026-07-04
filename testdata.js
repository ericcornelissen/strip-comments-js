// SPDX-License-Identifier: Apache-2.0

import * as fs from "node:fs/promises";
import * as path from "node:path";

export async function files() {
	const files = {};
	for (const file of await fs.readdir("testdata")) {
		if (!file.endsWith(".js")) continue;
		const filepath = path.resolve("testdata", file);
		files[file] = filepath;
	}

	return Object.entries(files);
}
