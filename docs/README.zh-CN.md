# path-treeify

> 📖 [English README](https://github.com/isaaxite/path-treeify/blob/main/README.md)

将一个路径或路径数组转换为树形 JavaScript 对象，每个节点均持有指向父节点的循环引用。

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

## 功能特性

- 🌲 从一个或多个目录路径构建递归树结构
- 🔗 每个节点携带 `parent` 循环引用，支持向上遍历
- 📍 每个节点自带 `getPath()` 方法，可直接获取自身路径
- 🔍 可选 `filter` 回调，作用于**所有深度**，包括顶层目录
- ⚡ `build()` 无需传参，自动扫描整个 `base` 目录
- 🎛️ `buildBy()` 支持传入目录名数组或顶层过滤函数两种形式
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
import { PathTreeify } from 'path-treeify';

const treeify = new PathTreeify({ base: '/your/project/root' });

// 按目录名扫描指定目录
const tree = treeify.buildBy(['src', 'tests']);

// 通过顶层过滤函数筛选目录
const filtered = treeify.buildBy(name => name !== 'node_modules' && !name.startsWith('.'));

// 或者一键扫描 base 下所有子目录
const fullTree = treeify.build();
```

---

## API

### `new PathTreeify(options)`

创建一个新实例。

| 选项     | 类型                          | 是否必填 | 说明                                                   |
|----------|-------------------------------|----------|--------------------------------------------------------|
| `base`   | `string`                      | ✅        | 扫描的根目录绝对路径                                    |
| `filter` | `FilterFunction`（见下方）    | ❌        | 作用于**所有深度**，包括 `base` 的直接子目录            |

`base` 必须存在且为目录，否则构造函数会抛出错误。

---

### `FilterFunction`

作为构造函数的 `filter` 选项传入，在树的每一层级（含顶层）递归调用。

```ts
type FilterFunction = (params: {
  name: string;    // 目录名称（路径末段）
  dirPath: string; // 父目录的绝对路径
}) => boolean;
```

返回 `true` 表示**保留**该目录并继续递归；返回 `false` 表示**跳过**整个子树。

**示例 — 在所有层级排除 `node_modules` 和隐藏目录：**

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  filter: ({ name }) => name !== 'node_modules' && !name.startsWith('.'),
});
```

---

### `build(): PathTreeNode`

扫描 `base` 下所有子目录（若设置了实例级 `filter` 则同时应用），返回一个合成根节点 `PathTreeNode`。

```ts
const tree = treeify.build();
```

---

### `buildBy(dirNames: string[]): PathTreeNode`

根据给定的目录名列表（相对于 `base`）构建树。

```ts
const tree = treeify.buildBy(['src', 'docs', 'tests']);
```

- 前后多余的斜杠会被自动去除。
- 若任意名称无法解析为 `base` 下的有效目录，则抛出错误。

### `buildBy(filter: (dirName: string) => boolean): PathTreeNode`

获取 `base` 下所有一级子目录，用给定的断言函数筛选后构建树。深度遍历时仍会应用实例级 `filter`。

```ts
const tree = treeify.buildBy(name => name !== 'node_modules' && !name.startsWith('.'));
```

> **注意：** 传入 `buildBy(fn)` 的断言函数仅用于选择哪些**顶层**目录参与构建。若需要在每一层级过滤，请在构造函数中传入 `filter` 选项。

---

### `getPathBy(node: PathTreeNode): { relative: string; absolute: string }`

沿节点的 `parent` 链向上还原完整路径，与直接调用 `node.getPath()` 等价。

```ts
const { relative, absolute } = treeify.getPathBy(node);
// relative → 例如 'src/components'
// absolute → 例如 '/your/project/src/components'
```

---

### `PathTreeNode`

`PathTreeNode` 是一个**类**，自带 `getPath()` 方法，无需将节点传回 `PathTreeify` 实例即可获取路径。

```ts
class PathTreeNode {
  parent:   PathTreeNode | null; // 仅合成根节点为 null
  value:    string;              // 当前节点的目录名
  children: PathTreeNode[];

  getPath(): { relative: string; absolute: string };
}
```

`node.getPath()` 与 `treeify.getPathBy(node)` 返回完全相同的结果，两者均可使用。

> ⚠️ **循环引用** — `parent` 指向树的上层节点。若需要序列化结果，请使用 `JSON.stringify` 的替换函数，或借助 `flatted` 等库处理循环引用。

---

## 示例

### 扫描整个 base 目录

```ts
import { PathTreeify } from 'path-treeify';

const treeify = new PathTreeify({ base: '/your/project' });
const tree = treeify.build();
```

### 通过构造函数 filter 在所有层级排除目录

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  filter: ({ name }) => name !== 'node_modules' && !name.startsWith('.'),
});
const tree = treeify.build();
```

### 扫描指定目录

```ts
const tree = treeify.buildBy(['src', 'tests', 'docs']);
```

### 用断言函数筛选顶层目录

```ts
const tree = treeify.buildBy(name => name !== 'node_modules' && !name.startsWith('.'));
```

### 通过 `node.getPath()` 获取路径

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

### CommonJS 用法

```js
const { PathTreeify } = require('path-treeify');

const treeify = new PathTreeify({ base: __dirname });
const tree = treeify.build();
```

---

## 许可证

[MIT](https://github.com/isaaxite/path-treeify/blob/main/LICENSE) © [isaaxite](https://github.com/isaaxite)
