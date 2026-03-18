# path-treeify

> 📖 [中文文档 (Chinese README)](https://github.com/isaaxite/path-treeify/blob/main/docs/README.zh-CN.md)

<div align="left">
  <!-- <h1>Path-Treeify</h1> -->
  <p>Convert a path or an array of paths into a tree-structured JavaScript object, where each node holds a circular reference to its parent. </p>
</div>

<div align="left">
  <a href="https://github.com/isaaxite/path-treeify">
    <img alt="GitHub package.json dynamic" src="https://img.shields.io/github/package-json/version/isaaxite/path-treeify?logo=github">
  </a>
  <a href="https://nodejs.org">
    <img alt="node" src="https://img.shields.io/node/v/path-treeify">
  </a>
  <a href="https://github.com/isaaxite/path-treeify/blob/main/LICENSE">
    <img alt="license" src="https://img.shields.io/npm/l/path-treeify">
  </a>
  <a href="https://github.com/isaaxite/path-treeify">
    <img alt="GitHub Created At" src="https://img.shields.io/github/created-at/isaaxite/path-treeify">
  </a>
  <a href="https://github.com/isaaxite/path-treeify">
    <img alt="GitHub code size in bytes" src="https://img.shields.io/github/languages/code-size/isaaxite/path-treeify">
  </a>
  <a href="https://github.com/isaaxite/path-treeify/commits/main/">
    <img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/isaaxite/path-treeify">
  </a>
  <a href="https://github.com/isaaxite/path-treeify/commits/main/">
    <img alt="GitHub last commit" src="https://img.shields.io/github/last-commit/isaaxite/path-treeify">
  </a>
</div>

---

## Features

- 🌲 Builds a recursive tree from one or more directory paths
- 🔗 Each node carries a `parent` circular reference for upward traversal
- 🔍 Optional `filter` callback to include/exclude directories during scanning
- 📦 Ships as both ESM (`index.mjs`) and CJS (`index.cjs`) with full TypeScript types
- 🚫 Zero runtime dependencies

---

## Requirements

- Node.js `>= 18.0.0`

---

## Installation

```bash
npm install path-treeify
```

```bash
yarn add path-treeify
```

---

## Quick Start

```ts
import { PathTreeify } from 'path-treeify';

const treeify = new PathTreeify({ base: '/your/project/root' });

// Scan the whole base directory
const tree = treeify.buildByDirPaths(['src', 'tests']);

console.log(tree);
// {
//   parent: null,
//   value: '',
//   children: [
//     { parent: [Circular], value: 'src',   children: [...] },
//     { parent: [Circular], value: 'tests', children: [...] }
//   ]
// }
```

---

## API

### `new PathTreeify(options)`

Creates a new instance.

| Option   | Type                          | Required | Description                                       |
|----------|-------------------------------|----------|---------------------------------------------------|
| `base`   | `string`                      | ✅        | Absolute path to the root directory to scan from |
| `filter` | `FilterFunction` (see below)  | ❌        | Called for every directory found during traversal |

`base` must exist and be a directory, otherwise the constructor throws.

---

### `FilterFunction`

```ts
type FilterFunction = (params: {
  name: string;    // directory name (leaf segment)
  dirPath: string; // absolute path of the parent directory
}) => boolean;
```

Return `true` to **include** the directory and recurse into it; `false` to **skip** it.

**Example — skip hidden directories and `node_modules`:**

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  filter: ({ name }) => !name.startsWith('.') && name !== 'node_modules',
});
```

---

### `buildByDirPaths(paths: string[]): PathTreeNode`

Scans the given relative directory paths (resolved against `base`) and returns a synthetic root `PathTreeNode` whose `children` are the top-level nodes you requested.

```ts
const root = treeify.buildByDirPaths(['src', 'docs']);
```

- Each element of `paths` must be a valid, accessible directory relative to `base`.
- Leading and trailing slashes are stripped automatically.
- Throws if any path does not exist or is not a directory.

---

### `getPathBy(node: PathTreeNode): { relative: string; absolute: string }`

Walks a node's `parent` chain to reconstruct its full path.

```ts
const srcNode = root.children[0];
const { relative, absolute } = treeify.getPathBy(srcNode);
// relative → 'src'
// absolute → '/your/project/src'
```

---

### `PathTreeNode`

```ts
interface PathTreeNode {
  parent:   PathTreeNode | null; // null only on the synthetic root
  value:    string;              // directory name for this node
  children: PathTreeNode[];
}
```

> ⚠️ **Circular references** — `parent` points back up the tree. Use `JSON.stringify` replacers or a library like `flatted` if you need to serialize the result.

---

## Examples

### Scan an entire directory

```ts
import { PathTreeify } from 'path-treeify';
import { readdirSync } from 'fs';

const base = '/your/project';
const treeify = new PathTreeify({ base });

// Collect all top-level directories
const topLevel = readdirSync(base, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

const tree = treeify.buildByDirPaths(topLevel);
```

### Retrieve absolute paths while walking

```ts
function printPaths(node, treeify) {
  for (const child of node.children) {
    const { absolute } = treeify.getPathBy(child);
    console.log(absolute);
    printPaths(child, treeify);
  }
}

printPaths(tree, treeify);
```

### CommonJS usage

```js
const { PathTreeify } = require('path-treeify');

const treeify = new PathTreeify({ base: __dirname });
const tree = treeify.buildByDirPaths(['src']);
```

---

## License

[MIT](https://github.com/isaaxite/path-treeify/blob/main//LICENSE) © [isaaxite](https://github.com/isaaxite)
