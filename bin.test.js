// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import { test } from "node:test";

import * as testdata from "./testdata.js";

test("regular usage", async () => {
	for (const [file, filepath] of await testdata.files()) {
		await test(file, async () => {
			const before = await fs.readFile(filepath);

			spawnSync("./bin.js", [filepath]);

			const got = await fs.readFile(filepath);
			const want = await fs.readFile(filepath.replace(/\.[a-z]+$/, ".want"));
			fs.writeFile(filepath, before);

			assert.deepEqual(got.toString(), want.toString());
		});
	}
});

test("--pattern", async () => {
	for (const [file, filepath] of await testdata.files()) {
		await test(file, async () => {
			const before = await fs.readFile(filepath);

			spawnSync("./bin.js", ["--pattern", "won't match", filepath]);

			const got = await fs.readFile(filepath);
			fs.writeFile(filepath, before);

			assert.deepEqual(got.toString(), before.toString());
		});
	}
});
