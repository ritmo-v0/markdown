# @ritmo-v0/markdown

A react-markdown wrapper with Ritmo's remark / rehype plugins built in. Components are passed in via the `components` prop.

## Install

```sh
pnpm add @ritmo-v0/markdown
```

The package imports KaTeX CSS (`katex-swap.min.css`) itself, so the app doesn't need to, but it must be consumed through a bundler (Next.js, Vite, …).

## Entry Points

| Path | Exports | Environment |
| --- | --- | --- |
| `@ritmo-v0/markdown` | `Markdown`, `omitNode`, types `MarkdownProps` / `Components` / `ExtraProps` / `Options` (from react-markdown) | client / server |
| `@ritmo-v0/markdown/server` | `MarkdownAsync` | Server Components only (`server-only`) |
| `@ritmo-v0/markdown/stream` | `MarkdownStream`, type `MarkdownStreamProps` | Client Components only (`"use client"`) |
| `@ritmo-v0/markdown/plugins` | all plugins | `rehypeImageSize` depends on `node:fs`, so don't use this entry in the client |

```tsx
import { Markdown } from "@ritmo-v0/markdown";
import { MarkdownAsync } from "@ritmo-v0/markdown/server";

<Markdown components={COMPONENTS}>{source}</Markdown>
<MarkdownAsync components={COMPONENTS}>{source}</MarkdownAsync>
```

`MarkdownAsync` additionally runs `rehypeImageSize`, which writes `width` / `height` to `<img>`.

### Streaming

`MarkdownStream` renders each top-level block as its own memoized `Markdown`, so only the last (still growing) block renders again. Heading slugs are always off.

```tsx
import { MarkdownStream } from "@ritmo-v0/markdown/stream";

<MarkdownStream streaming={isStreaming}>{text}</MarkdownStream>
```

While `streaming` (default `true`), the last block goes through [Remend](https://github.com/vercel/streamdown/tree/main/packages/remend): half-typed inline syntax is completed (`**bold` → `**bold**`, a half-typed link shows as its text), and anything that would render at a different height until it's finished is hidden instead: a last line of only markers (`#`, `-`, `1.`, `|---`, `$`…), an unclosed `$$` formula, a half-typed image or HTML tag. Set `streaming={false}` once the text is final, or a message that really ends that way stays hidden.

### Default components

Wrap `Markdown` / `MarkdownAsync` / `MarkdownStream` in your own component, merging per-call `components` over your defaults:

```tsx
// components/markdown.tsx
import {
  Markdown as BaseMarkdown,
  type MarkdownProps,
} from "@ritmo-v0/markdown";

export function Markdown({ components, ...props }: MarkdownProps) {
  return (
    <BaseMarkdown
      components={components ? { ...COMPONENTS, ...components } : COMPONENTS}
      {...props}
    />
  );
}
```

Define `COMPONENTS` at module level (inline arrow functions there are fine) and pass `COMPONENTS` itself when there's nothing to merge. A new object on every render is harmless for `Markdown` / `MarkdownAsync`, but makes `MarkdownStream` render every block again.

By default (`omitNode`), components don't receive react-markdown's `node` prop, so spreading props onto a DOM element is safe. Wrappers are cached per component, so the same component always gets the same wrapper and never remounts on re-render. Set `omitNode={false}` to get `node`; `omitNode(Component)` does the same for a single component.

## Props

All react-markdown `Options`, plus:

| Prop | Default | Description |
| --- | --- | --- |
| `afterRaw` | — | Rehype plugins inserted right after `rehype-raw` (before slug / katex) |
| `omitNode` | `true` | When `true`, `components` don't receive react-markdown's `node` prop |
| `renderH1` | `true` | When `false`, adds `h1` to `disallowedElements` |
| `slug` | `true` | When `false`, skips `rehype-slug`, so headings get no `id` |

`remarkPlugins` / `rehypePlugins` passed in are appended after the built-in plugins.

## Plugin Order

```
remark: breaks → gfm → math → cjk → cjk-strikethrough → directive → text / leaf / container directive
rehype: raw → (imageSize) → slug → katex
```

- `rehypeKatex`: a custom implementation that behaves like `rehype-katex` but uses the package's own `katex`, so the HTML and CSS always come from the same version
- `rehypeImageSize`: remote images are fetched with native `fetch` (10 s timeout, aborted once the header is read) and parsed by `probe-image-size/stream`; paths starting with `/` are read from `process.cwd()/public`. Results are cached per worker. On failure it only `console.warn`s
