import "server-only";
import "katex/dist/katex-swap.min.css";
import { MarkdownAsync as ReactMarkdownAsync } from "react-markdown";
import { rehypeImageSize } from "./plugins/rehype-image-size.js";
import { withPlugins } from "./shared.js";

// Types & Interfaces
import type { ReactElement } from "react";
import type { MarkdownProps } from "./shared.js";



export function MarkdownAsync(props: MarkdownProps): Promise<ReactElement> {
	return ReactMarkdownAsync(withPlugins({
		...props,
		afterRaw: [rehypeImageSize, ...(props.afterRaw ?? [])],
	}));
}