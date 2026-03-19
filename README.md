# path-treeify

> 📖 [中文文档 (Chinese README)](https://github.com/isaaxite/path-treeify/blob/main/docs/README.zh-CN.md)

<div align="left">
  <!-- <h1>Path-Treeify</h1> -->
  <p>Convert a path or an array of paths into a tree-structured JavaScript object, where each node holds a circular reference to its parent. </p>
</div>

<div align="left">
  <a href="https://www.npmjs.com/package/path-treeify">
    <img alt="NPM Version" src="https://img.shields.io/npm/v/path-treeify">
  </a>
  <a href="https://nodejs.org">
    <img alt="node" src="https://img.shields.io/node/v/path-treeify">
  </a>
  <a href="https://github.com/isaaxite/path-treeify/blob/main/LICENSE">
    <img alt="GitHub License" src="https://img.shields.io/github/license/isaaxite/path-treeify">
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
- 📍 Each node exposes a `getPath()` method to retrieve its own paths directly
- 🔍 Optional `filter` callback to include/exclude directories during scanning
- ⚡ `build()` scans the entire `base` directory with zero configuration
- 🎛️ `buildBy()` accepts either a directory name array or a filter function
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

// Scan specific directories by name
const tree = treeify.buildBy(['src', 'tests']);

// Scan with a filter function over all top-level directories
const filtered = treeify.buildBy(name => !name.startsWith('.') && name !== 'node_modules');

// Or scan everything under base at once
const fullTree = treeify.build();
```

---

## API

### `new PathTreeify(options)`

Creates a new instance.

| Option   | Type                          | Required | Description                                        |
|----------|-------------------------------|----------|----------------------------------------------------|
| `base`   | `string`                      | ✅        | Absolute path to the root directory to scan from  |
| `filter` | `FilterFunction` (see below)  | ❌        | Called for every directory found during deep traversal |

`base` must exist and be a directory, otherwise the constructor throws.

---

### `FilterFunction`

Used as the `filter` option in the constructor. Applied recursively during deep traversal of the tree.

```ts
type FilterFunction = (params: {
  name: string;    // directory name (leaf segment)
  dirPath: string; // absolute path of the parent directory
}) => boolean;
```

Return `true` to **include** the directory and recurse into it; `false` to **skip** it.

**Example — skip hidden directories and `node_modules` at every level:**

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  filter: ({ name }) => !name.startsWith('.') && name !== 'node_modules',
});
```

---

### `build(): PathTreeNode`

Scans **all** subdirectories directly under `base` and returns a synthetic root `PathTreeNode`. This is the zero-configuration shorthand.

```ts
const tree = treeify.build();
```

---

### `buildBy(dirNames: string[]): PathTreeNode`

Builds a tree from the given list of directory names (relative to `base`).

```ts
const tree = treeify.buildBy(['src', 'docs', 'tests']);
```

- Leading and trailing slashes are stripped automatically.
- Throws if any name does not resolve to a valid directory under `base`.

### `buildBy(filter: (dirName: string) => boolean): PathTreeNode`

Collects all top-level subdirectories under `base`, applies the given filter function, then builds a tree from the matching names.

```ts
const tree = treeify.buildBy(name => name !== 'node_modules' && !name.startsWith('.'));
```

> Note: this `filter` operates only on the **top-level** directory names under `base`. For filtering at every depth, pass a `filter` to the constructor instead.

---

### `getPathBy(node: PathTreeNode): { relative: string; absolute: string }`

Walks a node's `parent` chain to reconstruct its full path. Equivalent to calling `node.getPath()` directly.

```ts
const { relative, absolute } = treeify.getPathBy(node);
```

---

### `PathTreeNode`

`PathTreeNode` is a **class** with its own `getPath()` method, so you can retrieve a node's path without passing it back to the `PathTreeify` instance.

```ts
class PathTreeNode {
  parent:   PathTreeNode | null; // null only on the synthetic root
  value:    string;              // directory name for this node
  children: PathTreeNode[];

  getPath(): { relative: string; absolute: string };
}
```

**`node.getPath()`** returns the same result as `treeify.getPathBy(node)` — both are available for convenience.

> ⚠️ **Circular references** — `parent` points back up the tree. Use `JSON.stringify` replacers or a library like `flatted` if you need to serialize the result.

---

## Examples

### Scan an entire base directory

```ts
import { PathTreeify } from 'path-treeify';

const treeify = new PathTreeify({ base: '/your/project' });
const tree = treeify.build();
```

### Scan specific directories

```ts
const tree = treeify.buildBy(['src', 'tests', 'docs']);
```

### Filter top-level directories

```ts
const tree = treeify.buildBy(name => name !== 'node_modules' && !name.startsWith('.'));
```

### Filter at every depth via constructor

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  filter: ({ name }) => name !== 'node_modules' && !name.startsWith('.'),
});
const tree = treeify.build();
```

### Retrieve paths via `node.getPath()`

```ts
function printPaths(node) {
  for (const child of node.children) {
    const { absolute } = child.getPath();
    console.log(absolute);
    printPaths(child);
  }
}

printPaths(tree);
```

### CommonJS usage

```js
const { PathTreeify } = require('path-treeify');

const treeify = new PathTreeify({ base: __dirname });
const tree = treeify.build();
```

---

## License

[MIT](https://github.com/isaaxite/path-treeify/blob/main/LICENSE) © [isaaxite](https://github.com/isaaxite)
