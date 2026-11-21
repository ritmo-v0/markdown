"use client";
import "katex/dist/katex-swap.min.css";
import { createElement, memo, useMemo, useState } from "react";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import remarkParse from "remark-parse";
import remend, { INCOMPLETE_IMAGE_PLACEHOLDER } from "remend";
import { REMARK_SYNTAX_PLUGINS, withPlugins } from "./shared.js";

// Components & UI
import { Fragment } from "react";
import ReactMarkdown from "react-markdown";

// Types & Interfaces
import type { ReactElement } from "react";
import type { Root, RootContent } from "mdast";
import type { RemendHandler, RemendOptions } from "remend";
import type { MarkdownProps } from "./shared.js";
type MarkdownBlockProps = Omit<MarkdownProps, "slug">;
export type MarkdownStreamProps = MarkdownBlockProps & {
	streaming?: boolean;
};
type Block = {
	text: string;
	definitions: string[];
};
type SplitterState = {
	text: string;
	resumeAt: number;
	blocks: ParsedBlock[];
	definitions: ParsedDefinition[];
};
type ParsedBlock = {
	start: number;
	text: string;
	references: string[];
	hasFootnote: boolean;
};
type ParsedDefinition = { start: number, identifier: string, text: string };

// Constants & Variables
const PARSER = unified().use(remarkParse).use(REMARK_SYNTAX_PLUGINS);
const MARKERS_ONLY = /^[ \t#>*+\-_=`~|:.)\d$]+$/;
const INCOMPLETE_IMAGE = new RegExp(`!\\[[^\\]]*\\]\\(${INCOMPLETE_IMAGE_PLACEHOLDER}\\)$`);

const hideOpenMath: RemendHandler = {
	name: "hideOpenMath",
	priority: -2,
	handle: (text) => {
		const start = findOpenMath(text);
		return start === null ? text : text.slice(0, start);
	},
};

const hideMarkerLine: RemendHandler = {
	name: "hideMarkerLine",
	priority: -1,
	handle: (text) => {
		const lineStart = text.lastIndexOf("\n") + 1;
		return MARKERS_ONLY.test(text.slice(lineStart)) ? text.slice(0, lineStart) : text;
	},
};

const hideIncompleteImage: RemendHandler = {
	name: "hideIncompleteImage",
	priority: 100,
	handle: (text) => text.replace(INCOMPLETE_IMAGE, ""),
};

const REMEND_OPTIONS: RemendOptions = {
	katex: false,
	linkMode: "text-only",
	handlers: [hideOpenMath, hideMarkerLine, hideIncompleteImage],
};



export function MarkdownStream({
	children,
	streaming = true,
	...props
}: MarkdownStreamProps): ReactElement {
	const [split] = useState(createMarkdownBlockSplitter);
	const blocks = useMemo(() => split(children ?? ""), [split, children]);

	return createElement(Fragment, null, blocks.map((block, index) => {
		const isTail = streaming && index === blocks.length - 1;
		const text = joinBlock(isTail ? { ...block, text: remend(block.text, REMEND_OPTIONS) } : block);

		return createElement(MarkdownBlock, { ...props, key: index, children: text });
	}));
}

const MarkdownBlock = memo(function MarkdownBlock(props: MarkdownBlockProps) {
	return ReactMarkdown(withPlugins({ ...props, slug: false }));
});

// Each block's definitions stay apart from its text, so only the block's own text is remended
function createMarkdownBlockSplitter() {
	let state: SplitterState | null = null;

	return (text: string): Block[] => {
		state = state && text.startsWith(state.text)
			? parseFrom(text, state.resumeAt, state)
			: parseFrom(text, 0, null);

		return toBlocks(state);
	};
}

function joinBlock({ text, definitions }: Block) {
	// Definitions go first: after the text, an unclosed code fence at its end would swallow them
	return [...definitions, text].join("\n\n");
}

function parseFrom(text: string, from: number, previous: SplitterState | null): SplitterState {
	const keptBlocks = previous?.blocks.filter(block => block.start < from) ?? [];
	const keptDefinitions = previous?.definitions.filter(definition => definition.start < from) ?? [];

	// Known definitions go after the tail, so references to them still parse as references
	const tail = text.slice(from);
	const source = [tail, ...keptDefinitions.map(definition => definition.text)].join("\n\n");
	const nodes = (PARSER.parse(source) as Root).children
		.filter(node => (node.position?.start.offset ?? 0) < tail.length);

	const blocks = [...keptBlocks];
	const definitions = [...keptDefinitions];
	for (const node of nodes) {
		// From the start of the line: a node can begin after indentation that its later lines are relative to
		const start = from + (node.position?.start.offset ?? 0) - ((node.position?.start.column ?? 1) - 1);
		const nodeText = text.slice(start, from + (node.position?.end.offset ?? tail.length));

		if (node.type === "definition" || node.type === "footnoteDefinition") {
			definitions.push({ start, identifier: definitionKey(node), text: nodeText });
		} else {
			blocks.push({ start, text: nodeText, ...collectReferences(node) });
		}
	}

	// A new definition can turn text in earlier blocks into references: parse everything again (rare)
	const knownKeys = new Set(previous?.definitions.map(definition => definition.identifier));
	if (from > 0 && definitions.some(definition => !knownKeys.has(definition.identifier))) {
		return parseFrom(text, 0, null);
	}

	const starts = [...blocks, ...definitions].map(item => item.start).sort((a, b) => a - b);
	const resumeAt = starts.length > 1 ? starts[starts.length - 2] : 0;

	return { text, resumeAt, blocks, definitions };
}

function toBlocks({ text, blocks, definitions }: SplitterState): Block[] {
	const footnoteIndex = blocks.findIndex(block => block.hasFootnote);
	const plainBlocks = footnoteIndex === -1 ? blocks : blocks.slice(0, footnoteIndex);

	const result = plainBlocks.map(block => ({
		text: block.text,
		definitions: definitions
			.filter(definition => block.references.includes(definition.identifier))
			.map(definition => definition.text),
	}));
	if (footnoteIndex !== -1) {
		const start = blocks[footnoteIndex].start;
		result.push({
			text: text.slice(start).trimEnd(),
			definitions: definitions
				.filter(definition => definition.start < start)
				.map(definition => definition.text),
		});
	}

	return result;
}

function collectReferences(node: RootContent) {
	const references: string[] = [];
	let hasFootnote = false;
	visit(node, (child) => {
		if (child.type === "linkReference" || child.type === "imageReference") references.push(child.identifier);
		if (child.type === "footnoteReference") hasFootnote = true;
	});

	return { references, hasFootnote };
}

function definitionKey(node: Extract<RootContent, { type: "definition" | "footnoteDefinition" }>) {
	return node.type === "footnoteDefinition" ? `^${node.identifier}` : node.identifier;
}

// Start of the last `$$` formula outside code fences that has no closing `$$` yet, or `null`
function findOpenMath(text: string) {
	let open: number | null = null;
	let inFence = false;
	let lineStart = true;

	for (let i = 0; i < text.length;) {
		if (lineStart && open === null && /^ {0,3}(```|~~~)/.test(text.slice(i, i + 6))) {
			inFence = !inFence;
		}
		lineStart = false;

		if (!inFence && text[i] === "\\") {
			i += 2;
			continue;
		}
		if (!inFence && text.startsWith("$$", i)) {
			open = open === null ? i : null;
			i += 2;
			continue;
		}
		lineStart = text[i] === "\n";
		i++;
	}

	return open;
}