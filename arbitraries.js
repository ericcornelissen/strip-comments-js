// SPDX-License-Identifier: Apache-2.0

import * as fc from "fast-check";

const charsets = {
	letters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
	numeric: "1234567890".split(""),
};

const _checked =
	(fn) =>
	({ depth }) =>
		depth > 1 ? fc.constant("") : fn({ depth });

export const whitespace = () => fc.string({ unit: fc.constantFrom(" ", "\t") });

export const comment = {
	any: (content) => fc.oneof(comment.block(content), comment.line(content)),
	block: (content) =>
		fc
			.record({
				content: content || fc.string().filter((s) => !s.includes("*/")),
				pre: whitespace(),
				start: whitespace(),
				end: whitespace(),
				post: whitespace(),
			})
			.map(
				({ pre, start, content, end, post }) =>
					`${pre}/*${start}${content}${end}*/${post}`,
			),
	line: (content) =>
		fc
			.record({
				content: content || fc.string().filter((s) => !s.includes("\n")),
				pre: whitespace(),
				start: whitespace(),
				end: whitespace(),
			})
			.map(
				({ pre, start, content, end }) => `${pre}//${start}${content}${end}\n`,
			),
};

export const javascript = {
	program: () => javascript.statement.list({ depth: 0 }),

	statement: {
		any: ({ depth }) =>
			fc
				.record({
					statement: fc.oneof(
						...Object.entries(javascript.statement)
							.filter(
								([key]) => key !== "any" && key !== "list" && key !== "body",
							)
							.map(([, arbitrary]) => {
								return arbitrary({ depth });
							}),
					),
					sep: fc.constantFrom(";", "\n", ";\n"),
				})
				.map(({ statement, sep }) => `${statement}${sep}`),
		list: ({ depth }) =>
			fc
				.array(javascript.statement.any({ depth }), {
					minLength: 0,
					maxLength: 5,
				})
				.map((statements) => statements.join("")),

		body: _checked(({ depth }) =>
			javascript.statement.list({ depth: depth + 1 }).map((body) =>
				body
					.split("\n")
					.map((line) => `\t${line}`)
					.join("\n"),
			),
		),

		assignment: () =>
			fc
				.record({
					lhs: javascript.identifier.any(),
					eqs: fc.stringMatching(/^ ?= ?$/),
					rhs: javascript.expression.any(),
				})
				.map(({ lhs, eqs, rhs }) => `${lhs}${eqs}${rhs}`),
		assignments: () =>
			fc
				.array(javascript.statement.assignment(), {
					minLength: 1,
					maxLength: 5,
				})
				.map((assignments) => assignments.join(", ")),
		declaration: () =>
			fc
				.record({
					kind: fc.constantFrom("var", "let", "const"),
					assignments: javascript.statement.assignments(),
				})
				.map(({ kind, assignments }) => `${kind} ${assignments}`),
		expression: () => javascript.expression.any(),
		function: _checked(({ depth }) =>
			fc
				.record({
					args: fc.array(javascript.identifier.any(), {
						minLength: 0,
						maxLength: 5,
					}),
					body: javascript.statement.body({ depth }),
				})
				.map(({ args, body }) => `function(${args}) {\n${body}\n}`),
		),
		if: _checked(({ depth }) =>
			fc
				.record({
					guard: javascript.expression.any(),
					body: javascript.statement.body({ depth }),
				})
				.map(({ guard, body }) => `if (${guard}) {\n${body}\n}`),
		),
		ifelse: _checked(({ depth }) =>
			fc
				.record({
					ifs: javascript.statement.ifelseif({ depth }),
					body: javascript.statement.body({ depth }),
				})
				.map(({ ifs, body }) => `${ifs} else {\n${body}\n}`),
		),
		ifelseif: _checked(({ depth }) =>
			fc
				.array(javascript.statement.if({ depth }), {
					minLength: 2,
					maxLength: 4,
				})
				.map((ifs) => ifs.join(" else ")),
		),
		return: () => javascript.expression.any().map((expr) => `return ${expr}`),
		while: _checked(({ depth }) =>
			fc
				.record({
					guard: javascript.expression.any(),
					body: javascript.statement.body({ depth }),
				})
				.map(({ guard, body }) => `while(${guard}) {\n${body}\n}`),
		),
	},
	expression: {
		any: ({ depth } = { depth: 0 }) =>
			fc.oneof(
				...Object.entries(javascript.expression)
					.filter(([key]) => key !== "any")
					.map(([, arbitrary]) => arbitrary({ depth })),
			),

		tmp: () => fc.constantFrom("true", "false", "undefined", "null"),
		literal: _checked(({ depth }) =>
			javascript.literal.any({ depth: depth + 1 }),
		),
		identifier: () => javascript.identifier.any(),
	},
	literal: {
		any: ({ depth }) =>
			fc.oneof(
				...Object.entries(javascript.literal)
					.filter(([key]) => key !== "any")
					.map(([, arbitrary]) => arbitrary({ depth })),
			),

		array: _checked(({ depth }) =>
			fc
				.array(javascript.expression.any({ depth: depth + 1 }), {
					minLength: 0,
					maxLength: 5,
				})
				.map((expressions) => `[${expressions.join(", ")}]`),
		),
		number: () =>
			fc.oneof(
				fc.integer(),
				fc.float(),
				fc.double(),
				fc
					.tuple(fc.integer(), fc.integer({ min: 0 }))
					.map(([a, b]) => `${a}${b}n`),
			),
		string: ({ depth }) =>
			fc.oneof(
				fc
					.string()
					.filter((s) => !/(?!\\)'|\\$/.test(s))
					.map((s) => `'${s}'`),
				fc
					.string()
					.filter((s) => !/(?!\\)"|\\$/.test(s))
					.map((s) => `"${s}"`),
				fc
					.record({
						tagFunction: fc.oneof(fc.constant(""), javascript.identifier.any()),
						text: fc
							.array(
								fc
									.record({
										pre: fc.string(),
										expression: javascript.expression.any({ depth: depth + 1 }),
										post: fc.string(),
									})
									.map(
										({ pre, expression, post }) =>
											`${pre}\${${expression}}${post}`,
									),
								{ maxLength: 3 },
							)
							.filter((s) => !/(?!\\)`|(?!\\)\$|\\$/.test(s))
							.map((s) => `\`${s}\``),
					})
					.map(({ tagFunction, text }) => `${tagFunction}${text}`),
			),
	},
	identifier: {
		any: () =>
			fc
				.tuple(
					fc.constantFrom(...charsets.letters, "_", "$"),
					fc.string({
						unit: fc.constantFrom(
							...charsets.numeric,
							...charsets.letters,
							"_",
							"$",
						),
					}),
				)
				.map(([a, b]) => `${a}${b}`)
				.filter((ident) => !javascript.keywords.includes(ident)),
	},

	keywords: ["var", "let", "const", "if", "else", "return", "function"],
};
