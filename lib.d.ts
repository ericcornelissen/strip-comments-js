// SPDX-License-Identifier: Apache-2.0

export type Options = {
	/** The pattern of comments to strip. */
	pattern?: RegExp;

	/** Whether to strip block comments. */
	block?: boolean;

	/** Whether to strip line comments. */
	line?: boolean;

	/** Whether to strip JSDoc comments. */
	jsdoc?: boolean;

	/** Whether to strip protected comments. */
	protected?: boolean;

	/** Whether to strip sourcemap comments. */
	sourcemap?: boolean;

	/** Whether to strip SPDX short-form identifiers. */
	spdx?: boolean;
};

/**
 * Strip comments from a piece of code.
 *
 * @param code The code to strip comments from.
 * @param options The options for stripping.
 * @return The stripped code.
 */
export function stripComments(code: string, options?: Options): string;
