// SPDX-License-Identifier: Apache-2.0

const strings = /"(?:\\"|[^"\n])*"|'(?:\\'|[^'\n])*'|`(?:\\`|[^`])*`/;

const patterns = [
	// eslint
	blockComment(/eslint-(disable|enable)/),
	anyComment(/eslint-disable-(next-)?line/),

	// type-coverage
	anyComment(/type-coverage:ignore-(next-)?line/),
];

export function strip(s) {
	for (const pattern of patterns) {
		s = s.replace(pattern, "$1");
	}

	return s;
}

function anyComment(regex) {
	const line = lineComment(regex);
	const block = blockComment(regex);
	return new RegExp(`(?:${block.source}|${line.source})`, "g");
}

function lineComment(regex) {
	const pattern = `(${strings.source})|(?<![ \t])\n?[ \t]*//[ \t]*${regex.source}[^\n]*(?=\n|$)`;
	return new RegExp(pattern, "g");
}

function blockComment(regex) {
	const pattern = `(${strings.source})|(?<![ \t])\n?[ \t]*/\\*[ \t]*${regex.source}(\\*[^/]|[^*])*\\*/[ \t]*`;
	return new RegExp(pattern, "g");
}
