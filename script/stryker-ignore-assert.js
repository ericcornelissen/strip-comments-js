// SPDX-License-Identifier: Apache-2.0

import { PluginKind, declareValuePlugin } from "@stryker-mutator/api/plugin";

export const strykerPlugins = [
	declareValuePlugin(PluginKind.Ignore, "assert", {
		shouldIgnore(path) {
			if (
				path.isExpressionStatement() &&
				path.node.expression.type === "CallExpression" &&
				path.node.expression.callee.type === "Identifier" &&
				path.node.expression.callee.name === "assert"
			) {
				return "Do not mutate debug assertions";
			}
		},
	}),
];
