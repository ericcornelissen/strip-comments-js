// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import { test } from "node:test";

import * as testdata from "./testdata.js";

test("regular usage", async (t) => {
	for (using testcase of await testdata.files()) {
		await t.test(testcase.name, async () => {
			cli(testcase.filepath, ...testcase.flags);
			const got = await fs.readFile(testcase.filepath, { encoding: "utf-8" });
			assert.equal(got, testcase.want);
		});
	}
});

test("auxiliary flags", async (t) => {
	await t.test("--help", () => {
		const { status } = cli("--help");
		assert.equal(status, 0);
	});

	await t.test("--version", () => {
		const { status } = cli("--version");
		assert.equal(status, 0);
	});
});

test("end of flags", () => {
	const { status, stderr } = cli("--", "--help");
	assert.equal(status, 1);
	assert.equal(stderr, "ENOENT: no such file or directory, open '--help'\n");
});

function cli(...args) {
	return spawnSync("./bin.js", args, { encoding: "utf-8" });
}
