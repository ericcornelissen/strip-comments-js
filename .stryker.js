// Configuration file for StrykerJS (https://stryker-mutator.io/)

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
		nodeArgs: ["--import", "./.stryker.js"],
	},

	ignorers: ["assert"],

	incremental: true,
	incrementalFile: "node_modules/.cache/stryker-incremental.json",

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

// Use this file to configure fast-check when mutation testing to speed up the
// process and increase consistency.
import * as fc from "fast-check";
fc.configureGlobal({ numRuns: 0 });
