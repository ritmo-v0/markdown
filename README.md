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
| `@ritmo-v0/markdown` | `Markdown`, `MarkdownProps`, types `Components` / `ExtraProps` / `Options` (from react-markdown) | client / server |
| `@ritmo-v0/markdown/server` | `MarkdownAsync` | Server Components only (`server-only`) |
| `@ritmo-v0/markdown/plugins` | all plugins | `rehypeImageSize` depends on `node:fs`, so don't use this entry in the client |

```tsx
import { Markdown } from "@ritmo-v0/markdown";
import { MarkdownAsync } from "@ritmo-v0/markdown/server";

<Markdown components={COMPONENTS}>{source}</Markdown>
<MarkdownAsync components={COMPONENTS}>{source}</MarkdownAsync>
```

`MarkdownAsync` additionally runs `rehypeImageSize`, which writes `width` / `height` to `<img>`.

## Props

All react-markdown `Options`, plus:

| Prop | Default | Description |
| --- | --- | --- |
| `afterRaw` | — | Rehype plugins inserted right after `rehype-raw` (before slug / katex) |
| `renderH1` | `true` | When `false`, adds `h1` to `disallowedElements` |

`remarkPlugins` / `rehypePlugins` passed in are appended after the built-in plugins.

## Plugin Order

```
remark: breaks → gfm → math → cjk → cjk-strikethrough → directive → text / leaf / container directive
rehype: raw → (imageSize) → slug → katex
```

- `rehypeKatex`: a custom implementation that behaves like `rehype-katex` but uses the package's own `katex`, so the HTML and CSS always come from the same version
- `rehypeImageSize`: remote images are fetched with native `fetch` (10 s timeout, aborted once the header is read) and parsed by `probe-image-size/stream`; paths starting with `/` are read from `process.cwd()/public`. Results are cached per worker. On failure it only `console.warn`s
