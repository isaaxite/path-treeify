<div align="center">
  <img alt="LOGO" width="320" src="https://assets-amu.pages.dev/path-treeify/logo.png">
</div>
<br/>

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
  <a href="https://github.com/isaaxite/path-treeify/blob/main/CHANGELOG.md">
    <img alt="CHANGELOG" src="https://img.shields.io/badge/changelog-maintained-brightgreen">
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
  <a href='https://github.com/isaaxite/path-treeify/actions/workflows/unittests.yml'>
    <img src='https://github.com/isaaxite/path-treeify/actions/workflows/unittests.yml/badge.svg' alt='Test CI Status' />
  </a>
  <a href='https://coveralls.io/github/isaaxite/path-treeify'>
    <img src='https://coveralls.io/repos/github/isaaxite/path-treeify/badge.svg' alt='Coverage Status' />
  </a>
</div>

---

## Features

- 🌲 Builds a recursive tree from one or more directory paths
- 🔗 Each node carries a `parent` circular reference for upward traversal
- 📍 Each node exposes a `getPath()` method to retrieve its own paths directly
- 🏷️ Each node has a `type` field — `PathTreeNodeKind.Dir` or `PathTreeNodeKind.File`
- 👁️ `fileVisible` option includes files as leaf nodes alongside directories
- 🔍 Optional `filter` callback applied at **every depth**, including top-level entries
- ⚡ `build()` scans the entire `base` directory with zero configuration
- 🎛️ `buildBy()` accepts either a path segment array or a top-level filter function
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
import { PathTreeify, PathTreeNodeKind } from 'path-treeify';

// Directories only (default)
const treeify = new PathTreeify({ base: '/your/project/root' });
const tree = treeify.build();

// Include files as leaf nodes
const treeifyWithFiles = new PathTreeify({
  base: '/your/project/root',
  fileVisible: true,
});
const fullTree = treeifyWithFiles.build();

// Check node type
for (const child of tree.children) {
  if (child.type === PathTreeNodeKind.Dir) {
    console.log('dir:', child.value);
  } else if (child.type === PathTreeNodeKind.File) {
    console.log('file:', child.value);
  }
}
```

---

## API

### `new PathTreeify(options)`

Creates a new instance.

| Option        | Type                         | Required | Description                                                              |
|---------------|------------------------------|----------|--------------------------------------------------------------------------|
| `base`        | `string`                     | ✅        | Absolute path to the root directory to scan from                        |
| `filter`      | `FilterFunction` (see below) | ❌        | Applied at **every depth** — top-level entries included                 |
| `fileVisible` | `boolean`                    | ❌        | When `true`, files are included as leaf nodes. Defaults to `false`      |

`base` must exist and be a directory, otherwise the constructor throws.

---

### `FilterFunction`

Used as the `filter` option in the constructor. Applied at every level of the tree, including the immediate children of `base`.

```ts
type FilterFunction = (params: {
  name: string;    // entry name (file or directory name)
  dirPath: string; // absolute path of the parent directory
}) => boolean;
```

Return `true` to **include** the entry; `false` to **skip** it entirely.

**Example — exclude `node_modules` and hidden entries at every depth:**

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  filter: ({ name }) => name !== 'node_modules' && !name.startsWith('.'),
});
```

---

### `build(): PathTreeNode`

Scans all entries directly under `base` that pass the instance-level `filter` and returns a synthetic root `PathTreeNode`. When `fileVisible` is `true`, files are included as leaf nodes.

```ts
const tree = treeify.build();
```

---

### `buildBy(segments: string[]): PathTreeNode`

Builds a tree from the given list of relative path segments. When `fileVisible` is `true`, file paths are also accepted.

```ts
const tree = treeify.buildBy(['src', 'docs', 'tests']);

// With fileVisible: true, files can also be specified
const treeWithFiles = new PathTreeify({ base: '/your/project', fileVisible: true });
treeWithFiles.buildBy(['src', 'README.md']);
```

- Both `/` and `\` separators are normalised automatically.
- Leading/trailing slashes and empty segments are stripped.
- Throws if any segment does not resolve to a valid entry under `base`.

### `buildBy(filter: (segment: string) => boolean): PathTreeNode`

Collects all top-level entries under `base`, applies the predicate to select which ones to include, then builds a tree. The instance-level `filter` still applies during deep traversal.

```ts
const tree = treeify.buildBy(name => name !== 'node_modules' && !name.startsWith('.'));
```

> **Note:** the predicate passed to `buildBy(fn)` only selects which **top-level** entries to include. To filter entries at every depth, pass a `filter` to the constructor.

---

### `PathTreeNode`

`PathTreeNode` is an **interface** — each node exposes a `getPath()` method to retrieve its paths without needing the `PathTreeify` instance.

```ts
interface PathTreeNode {
  parent:   PathTreeNode | null;  // null only on the synthetic root
  value:    string;               // entry name for this node
  children: PathTreeNode[];       // empty for file nodes
  type:     PathTreeNodeKind;     // Dir, File, or Unknown

  getPath(): { relative: string; absolute: string };
}
```

> ⚠️ **Circular references** — `parent` points back up the tree. Use `JSON.stringify` replacers or a library like `flatted` if you need to serialize the result.

---

### `PathTreeNodeKind`

An enum classifying each node's filesystem type.

```ts
enum PathTreeNodeKind {
  Dir     = 'dir',
  File    = 'file',
  Unknown = 'unknown', // assigned before the type is resolved
}
```

---

## Examples

### Directories only (default)

```ts
import { PathTreeify } from 'path-treeify';

const treeify = new PathTreeify({ base: '/your/project' });
const tree = treeify.build();
```

### Include files as leaf nodes

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  fileVisible: true,
});
const tree = treeify.build();
```

### Exclude directories at every depth via constructor filter

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  filter: ({ name }) => name !== 'node_modules' && !name.startsWith('.'),
});
const tree = treeify.build();
```

### Scan specific paths

```ts
const tree = treeify.buildBy(['src', 'tests', 'docs']);
```

### Select top-level entries with a predicate

```ts
const tree = treeify.buildBy(name => name !== 'node_modules' && !name.startsWith('.'));
```

### Retrieve paths via `node.getPath()`

```ts
function printPaths(node) {
  for (const child of node.children) {
    const { absolute } = child.getPath();
    console.log(`[${child.type}] ${absolute}`);
    printPaths(child);
  }
}

printPaths(tree);
```

### CommonJS usage

```js
const { PathTreeify, PathTreeNodeKind } = require('path-treeify');

const treeify = new PathTreeify({ base: __dirname });
const tree = treeify.build();
```

---

## License

[MIT](https://github.com/isaaxite/path-treeify/blob/main/LICENSE) © [isaaxite](https://github.com/isaaxite)
