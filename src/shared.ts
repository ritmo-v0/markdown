import { omitNodes } from "./components.js";

// Remark
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkCjk from "remark-cjk-friendly/parseOnly";
import remarkCjkGfmStrikethrough from "remark-cjk-friendly-gfm-strikethrough/parseOnly";
import remarkDirective from "remark-directive";
import {
	remarkTextDirective,
	remarkLeafDirective,
	remarkContainerDirective,
} from "./plugins/remark-directives.js";

// Rehype
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { rehypeKatex } from "./plugins/rehype-katex.js";

// Types & Interfaces
import type { Options } from "react-markdown";
import type { PluggableList } from "unified";
export type MarkdownProps = Options & {
	afterRaw?: Options["rehypePlugins"];
	omitNode?: boolean;
	renderH1?: boolean;
};

// Constants & Variables
const REMARK_PLUGINS: PluggableList = [
	remarkBreaks,
	[remarkGfm, { singleTilde: false }],
	[remarkMath, { singleDollarTextMath: false }],
	remarkCjk,
	remarkCjkGfmStrikethrough,
	remarkDirective,
	remarkTextDirective,
	remarkLeafDirective,
	remarkContainerDirective,
];
const REHYPE_PLUGINS: PluggableList = [rehypeRaw, rehypeSlug, rehypeKatex];



export function withPlugins({
	components,
	disallowedElements,
	remarkPlugins,
	rehypePlugins,
	afterRaw,
	omitNode = true,
	renderH1 = true,
	...props
}: MarkdownProps): Options {
	return {
		...props,
		components: omitNode && components ? omitNodes(components) : components,
		remarkPlugins: remarkPlugins?.length
			? [...REMARK_PLUGINS, ...remarkPlugins]
			: REMARK_PLUGINS,
		rehypePlugins: afterRaw?.length || rehypePlugins?.length
			? [
				rehypeRaw,
				...(afterRaw ?? []),
				rehypeSlug,
				rehypeKatex,
				...(rehypePlugins ?? []),
			]
			: REHYPE_PLUGINS,
		disallowedElements: renderH1
			? disallowedElements
			: [...(disallowedElements ?? []), "h1"],
	};
}