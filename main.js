// SPDX-License-Identifier: Apache-2.0

const strings = /"(?:\\"|[^"\n])*"|'(?:\\'|[^'\n])*'|`(?:\\`|[^`])*`/;

export function strip(s) {
	const pattern = anyComment();
	return s.replace(pattern, "$1");
}

function anyComment() {
	const line = lineComment();
	const block = blockComment();
	return new RegExp(`(?:${block.source}|${line.source})`, "g");
}

function lineComment() {
	const pattern = `(${strings.source})|(?<![ \t])\n?[ \t]*//[^\n]*(?=\n|$)`;
	return new RegExp(pattern, "g");
}

function blockComment() {
	const pattern = `(${strings.source})|(?<![ \t])\n?[ \t]*/\\*(\\*[^/]|[^*])*\\*/[ \t]*`;
	return new RegExp(pattern, "g");
}
