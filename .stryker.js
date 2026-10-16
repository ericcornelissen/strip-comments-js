// Configuration file for StrykerJS (https://stryker-mutator.io/)

import * as process from "node:process";

process.env.MUTATION_TESTING = 1;

export default {
	coverageAnalysis: "perTest",
	disableTypeChecks: false,
	inPlace: false,

	mutate: ["main.js"],
	plugins: ["@stryker-mutator/*", "./script/stryker-ignore-assert.js"],

	testRunner: "tap",
	tap: {
		forceBail: true,
		testFiles: ["main.test.js"],
	},

	timeoutFactor: 1.5,
	timeoutMS: 5_000,

	ignorers: ["assert"],

	incremental: true,
	incrementalFile: ".cache/mutation.json",

	reporters: ["clear-text", "html", "progress"],
	htmlReporter: {
		fileName: "mutation.html",
	},

	thresholds: {
		high: 100,
		low: 100,
		break: 100,
	},

	tempDirName: "node_modules/.temp/stryker",
	cleanTempDir: true,
};
