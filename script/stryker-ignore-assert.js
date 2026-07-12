// SPDX-License-Identifier: Apache-2.0

import { PluginKind, declareValuePlugin } from "@stryker-mutator/api/plugin";

export const strykerPlugins = [
	declareValuePlugin(PluginKind.Ignore, "assert", {
		shouldIgnore(path) {
			if (
				path.isCallExpression() &&
				path.node.callee.type === "Identifier" &&
				path.node.callee.name === "assert"
			) {
				return "Do not mutate assert() expressions";
			}
		},
	}),
];
