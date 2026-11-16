import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import probe from "probe-image-size/stream.js";
import { visit } from "unist-util-visit";

// Types & Interfaces
import type { Element, Root } from "hast";
import type { ReadableStream } from "node:stream/web";
type Size = { width: number, height: number };
export type RehypeImageSizeOptions = {
	/** Directory that `/`-prefixed paths resolve to. Defaults to `process.cwd()/public`. */
	publicDir?: string;
	/** Remote probe timeout in ms. Defaults to 10000. */
	timeout?: number;
};

// Constants & Variables
const cache = new Map<string, Promise<Size | null>>();



export function rehypeImageSize({
	publicDir = path.join(process.cwd(), "public"),
	timeout = 10_000
}: RehypeImageSizeOptions = {}) {
	return async (tree: Root) => {
		const images: Element[] = [];

		visit(tree, "element", (node) => {
			if (node.tagName !== "img") return;

			const { src, width, height } = node.properties;
			if (typeof src !== "string" || (width != null && height != null)) return;
			images.push(node);
		});

		await Promise.all(images.map(async (node) => {
			const src = node.properties.src as string;
			const key = `${publicDir}\0${src}`;

			let pending = cache.get(key);
			if (!pending) {
				pending = measure({ src, publicDir, timeout });
				cache.set(key, pending);
			}

			const size = await pending;
			if (!size) return;
			node.properties.width = size.width;
			node.properties.height = size.height;
		}));
	};
}

async function measure({
	src,
	publicDir,
	timeout
}: { src: string } & Required<RehypeImageSizeOptions>): Promise<Size | null> {
	try {
		const url = src.startsWith("//") ? `https:${src}` : src;

		if (/^https?:\/\//.test(url)) {
			const controller = new AbortController();
			try {
				const response = await fetch(url, {
					signal: AbortSignal.any([controller.signal, AbortSignal.timeout(timeout)]),
				});
				if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

				return await probeSize(Readable.fromWeb(response.body as ReadableStream));
			} finally {
				controller.abort();
			}
		}

		if (url.startsWith("/")) {
			const pathname = decodeURIComponent(url.split(/[?#]/)[0]);
			const root = path.resolve(publicDir);
			const file = path.join(root, pathname);
			if (!file.startsWith(root + path.sep)) return null;

			return await probeSize(createReadStream(file));
		}

		return null;
	} catch (error) {
		console.warn(`[rehypeImageSize] ${src}:`, error instanceof Error ? error.message : error);
		return null;
	}
}

async function probeSize(stream: Readable): Promise<Size> {
	try {
		const { width, height } = await probe(stream);
		return { width, height };
	} finally {
		stream.destroy();
	}
}