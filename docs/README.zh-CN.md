<div align="center">
  <img alt="LOGO"  width="320" src="https://assets-amu.pages.dev/path-treeify/logo.png">
</div>
<br/>

> 📖 [English README](https://github.com/isaaxite/path-treeify/blob/main/README.md)

将一个路径或路径数组转换为树形 JavaScript 对象，每个节点均持有指向父节点的循环引用。

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
    <img alt="NPM Unpacked Size" src="https://img.shields.io/npm/unpacked-size/path-treeify">
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

## 功能特性

- 🌲 从一个或多个目录路径构建递归树结构
- 🔗 每个节点携带 `parent` 循环引用，支持向上遍历
- 📍 每个节点自带 `getPath()` 方法，可直接获取自身路径
- 🏷️ 每个节点有 `type` 字段 — `PathTreeNodeKind.Dir` 或 `PathTreeNodeKind.File`
- 📏 每个节点有 `depth` 字段，表示距根节点的层级深度
- 👁️ `fileVisible` 选项可将文件作为叶节点纳入树中
- 🔍 可选 `filter` 回调，作用于**所有深度**，包括顶层条目
- ⚡ `build()` 无需传参，自动扫描整个 `base` 目录
- 🎛️ `buildBy()` 支持传入路径段数组或顶层过滤函数两种形式
- 🗃️ `usePathCache` 选项可对每个节点的 `getPath()` 结果进行缓存，适合重复访问场景
- 📦 同时提供 ESM（`index.mjs`）与 CJS（`index.cjs`），附带完整 TypeScript 类型声明
- 🚫 零运行时依赖

---

## 环境要求

- Node.js `>= 18.0.0`

---

## 安装

```bash
npm install path-treeify
```

```bash
yarn add path-treeify
```

---

## 快速上手

```ts
import { PathTreeify, PathTreeNodeKind } from 'path-treeify';

// 仅目录（默认行为）
const treeify = new PathTreeify({ base: '/your/project/root' });
const tree = treeify.build();

// 同时包含文件叶节点
const treeifyWithFiles = new PathTreeify({
  base: '/your/project/root',
  fileVisible: true,
});
const fullTree = treeifyWithFiles.build();

// 判断节点类型与层级深度
for (const child of tree.children) {
  if (child.type === PathTreeNodeKind.Dir) {
    console.log(`目录 (depth ${child.depth}):`, child.value);
  } else if (child.type === PathTreeNodeKind.File) {
    console.log(`文件 (depth ${child.depth}):`, child.value);
  }
}
```

---

## API

### `new PathTreeify(options)`

创建一个新实例。

| 选项           | 类型                          | 是否必填 | 说明                                                                     |
|----------------|-------------------------------|----------|--------------------------------------------------------------------------|
| `base`         | `string`                      | ✅        | 扫描的根目录绝对路径                                                      |
| `filter`       | `FilterFunction`（见下方）    | ❌        | 作用于**所有深度**，包括 `base` 的直接子条目                              |
| `fileVisible`  | `boolean`                     | ❌        | 为 `true` 时将文件纳入树中作为叶节点，默认 `false`                        |
| `usePathCache` | `boolean`                     | ❌        | 为 `true` 时，`getPath()` 的结果在首次调用后缓存于节点上，后续直接返回   |

`base` 必须存在且为目录，否则构造函数会抛出错误。

---

### `FilterFunction`

作为构造函数的 `filter` 选项传入，在树的每一层级（含顶层）递归调用。

```ts
type FilterFunction = (params: {
  name: string;    // 条目名称（文件名或目录名）
  dirPath: string; // 父目录的绝对路径
}) => boolean;
```

返回 `true` 表示**保留**该条目；返回 `false` 表示**跳过**整个子树。

**示例 — 在所有层级排除 `node_modules` 和隐藏条目：**

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  filter: ({ name }) => name !== 'node_modules' && !name.startsWith('.'),
});
```

---

### `build(): PathTreeNode`

扫描 `base` 下所有通过实例级 `filter` 的条目，返回一个合成根节点 `PathTreeNode`。`fileVisible` 为 `true` 时，文件也会作为叶节点出现。

```ts
const tree = treeify.build();
```

---

### `buildBy(segments: string[]): PathTreeNode`

根据给定的相对路径段列表构建树。`fileVisible` 为 `true` 时，也接受文件路径。

```ts
const tree = treeify.buildBy(['src', 'docs', 'tests']);

// fileVisible: true 时可指定文件
const treeWithFiles = new PathTreeify({ base: '/your/project', fileVisible: true });
treeWithFiles.buildBy(['src', 'README.md']);
```

- `/` 和 `\` 分隔符会自动统一为平台分隔符。
- 前后多余的斜杠和空段会自动清除。
- 若任意段无法解析为 `base` 下的有效条目，则抛出错误。

### `buildBy(filter: (segment: string) => boolean): PathTreeNode`

获取 `base` 下所有顶层条目，用给定的断言函数筛选后构建树。深度遍历时仍会应用实例级 `filter`。

```ts
const tree = treeify.buildBy(name => name !== 'node_modules' && !name.startsWith('.'));
```

> **注意：** 传入 `buildBy(fn)` 的断言函数仅用于选择哪些**顶层**条目参与构建。若需要在每一层级过滤，请在构造函数中传入 `filter` 选项。

---

### `PathTreeNode`

`PathTreeNode` 是一个 **interface**，每个节点自带 `getPath()` 方法，无需访问 `PathTreeify` 实例即可获取路径。

```ts
interface PathTreeNode {
  depth:    number;               // 距根节点的层级深度；根节点为 0，其直接子节点为 1，以此类推
  parent:   PathTreeNode | null;  // 仅合成根节点为 null
  value:    string;               // 当前节点的条目名
  children: PathTreeNode[];       // 文件节点为空数组
  type:     PathTreeNodeKind;     // Dir、File 或 Unknown

  getPath(): { relative: string; absolute: string };
}
```

当 `PathTreeify` 实例设置了 `usePathCache: true` 时，`getPath()` 的结果会在首次调用后缓存于节点上，后续调用直接返回同一对象引用，无需重新回溯父链。

> ⚠️ **循环引用** — `parent` 指向树的上层节点。若需要序列化结果，请使用 `JSON.stringify` 的替换函数，或借助 `flatted` 等库处理循环引用。

---

### `PathTreeNodeKind`

用于标识每个节点文件系统类型的枚举。

```ts
enum PathTreeNodeKind {
  Dir               = 'dir',
  File              = 'file',
  Unknown           = 'unknown',            // 类型尚未解析时的初始值
  BrokenSymlink     = 'broken_symlink',
  Other             = 'other',              // FIFO/socket 等，极少见
  NotFound          = 'not_found',
  PermissionDenied  = 'permission_denied',
  Error             = 'error',
}
```

---

## 示例

### 仅目录（默认行为）

```ts
import { PathTreeify } from 'path-treeify';

const treeify = new PathTreeify({ base: '/your/project' });
const tree = treeify.build();
```

### 同时包含文件叶节点

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  fileVisible: true,
});
const tree = treeify.build();
```

### 通过构造函数 filter 在所有层级排除条目

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  filter: ({ name }) => name !== 'node_modules' && !name.startsWith('.'),
});
const tree = treeify.build();
```

### 扫描指定路径

```ts
const tree = treeify.buildBy(['src', 'tests', 'docs']);
```

### 用断言函数筛选顶层条目

```ts
const tree = treeify.buildBy(name => name !== 'node_modules' && !name.startsWith('.'));
```

### 通过 `node.getPath()` 获取路径

```ts
function printPaths(node) {
  for (const child of node.children) {
    const { absolute } = child.getPath();
    console.log(`[${child.type}] depth=${child.depth} ${absolute}`);
    printPaths(child);
  }
}

printPaths(tree);
```

### 对 `getPath()` 结果启用缓存

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  usePathCache: true,
});
const tree = treeify.build();

// 首次调用回溯父链并缓存结果
const pathA = tree.children[0].getPath();
// 后续调用直接返回缓存对象
const pathB = tree.children[0].getPath();
console.log(pathA === pathB); // true
```

### CommonJS 用法

```js
const { PathTreeify, PathTreeNodeKind } = require('path-treeify');

const treeify = new PathTreeify({ base: __dirname });
const tree = treeify.build();
```

---

## 许可证

[MIT](https://github.com/isaaxite/path-treeify/blob/main/LICENSE) © [isaaxite](https://github.com/isaaxite)
