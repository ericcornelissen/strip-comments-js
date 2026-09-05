// SPDX-License-Identifier: Apache-2.0

import * as assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs/promises";
import { suite, test } from "node:test";

import * as testdata from "./testdata.js";

test("regular usage", async (t) => {
	for (using testcase of await testdata.files()) {
		await t.test(testcase.name, async () => {
			const { status } = cli(testcase.filepath, ...testcase.flags);
			assert.equal(status, 0);

			const got = await fs.readFile(testcase.filepath, { encoding: "utf-8" });
			assert.equal(got, testcase.want);
		});
	}
});

test("invalid file", () => {
	const { status } = cli("--error", "testdata/invalid.js");
	assert.equal(status, 1);
});

suite("auxiliary flags", () => {
	test("--help", () => {
		const { status } = cli("--help");
		assert.equal(status, 0);
	});

	test("--version", () => {
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
