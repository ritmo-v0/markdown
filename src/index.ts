import "katex/dist/katex-swap.min.css";
import ReactMarkdown from "react-markdown";
import { withPlugins } from "./shared.js";

// Types & Interfaces
import type { ReactElement } from "react";
import type { MarkdownProps } from "./shared.js";
export type { MarkdownProps };



export function Markdown(props: MarkdownProps): ReactElement {
	return ReactMarkdown(withPlugins(props));
}