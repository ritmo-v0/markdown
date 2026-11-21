import { createElement } from "react";

// Types & Interfaces
import type { ComponentType } from "react";
import type { Components, ExtraProps } from "react-markdown";

// Constants & Variables
const cache = new WeakMap<ComponentType<never>, ComponentType<never>>();



export function omitNodes(components: Components): Components {
	const result: Record<string, unknown> = {};

	for (const [tag, Component] of Object.entries(components)) {
		result[tag] = typeof Component === "string" || Component == null
			? Component
			: omitNode(Component as ComponentType<object>);
	}

	return result as Components;
}

export function omitNode<P extends object>(Component: ComponentType<P>): ComponentType<P & ExtraProps> {
	const cached = cache.get(Component as ComponentType<never>);
	if (cached) return cached as ComponentType<P & ExtraProps>;

	function WithoutNode({ node: _node, ...props }: P & ExtraProps) {
		return createElement(Component, props as P);
	}
	WithoutNode.displayName = `omitNode(${Component.displayName || Component.name || "Component"})`;

	cache.set(Component as ComponentType<never>, WithoutNode as ComponentType<never>);
	return WithoutNode;
}