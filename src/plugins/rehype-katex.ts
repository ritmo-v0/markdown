import katex from "katex";
import { fromHtmlIsomorphic } from "hast-util-from-html-isomorphic";
import { toText } from "hast-util-to-text";
import { SKIP, visitParents } from "unist-util-visit-parents";

// Types & Interfaces
import type { ElementContent, Root } from "hast";
import type { KatexOptions } from "katex";

export type RehypeKatexOptions = Omit<KatexOptions, "displayMode" | "throwOnError">;



export function rehypeKatex(options: RehypeKatexOptions = {}) {
	return (tree: Root) => {
		visitParents(tree, "element", (element, parents) => {
			const classes = Array.isArray(element.properties.className)
				? element.properties.className
				: [];
			const isLanguageMath = classes.includes("language-math");
			const isMathDisplay = classes.includes("math-display");
			const isMathInline = classes.includes("math-inline");
			if (!isLanguageMath && !isMathDisplay && !isMathInline) return;

			let displayMode = isMathDisplay;
			let scope = element;
			let parent = parents.at(-1);

			if (
				element.tagName === "code"
				&& isLanguageMath
				&& parent?.type === "element"
				&& parent.tagName === "pre"
			) {
				scope = parent;
				parent = parents.at(-2);
				displayMode = true;
			}
			if (!parent) return;

			const value = toText(scope, { whitespace: "pre" });
			let nodes: ElementContent[];
			try {
				const html = katex.renderToString(value, {
					...options,
					displayMode,
					throwOnError: false,
				});
				nodes = fromHtmlIsomorphic(html, { fragment: true }).children as ElementContent[];
			} catch (error) {
				console.warn("[rehypeKatex]", error);
				nodes = [{
					type: "element",
					tagName: "span",
					properties: {
						className: ["katex-error"],
						style: `color:${options.errorColor ?? "#cc0000"}`,
						title: String(error),
					},
					children: [{ type: "text", value }],
				}];
			}

			parent.children.splice(parent.children.indexOf(scope), 1, ...nodes);
			return SKIP;
		});
	};
}