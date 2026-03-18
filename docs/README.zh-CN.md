# path-treeify

> 📖 [English README](https://github.com/isaaxite/path-treeify/blob/main/README.md)

将一个路径或路径数组转换为树形 JavaScript 对象，每个节点均持有指向父节点的循环引用。

<div align="left">
  <a href="https://github.com/isaaxite/path-treeify">
    <img alt="GitHub package.json dynamic" src="https://img.shields.io/github/package-json/version/isaaxite/path-treeify?logo=github">
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
- 🔍 可选 `filter` 回调，用于在扫描时包含/排除目录
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

// 扫描指定的目录
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

创建一个新实例。

| 选项     | 类型                          | 是否必填 | 说明                                 |
|----------|-------------------------------|----------|--------------------------------------|
| `base`   | `string`                      | ✅        | 扫描的根目录绝对路径                  |
| `filter` | `FilterFunction`（见下方）    | ❌        | 遍历时对每个目录调用的过滤函数        |

`base` 必须存在且为目录，否则构造函数会抛出错误。

---

### `FilterFunction`

```ts
type FilterFunction = (params: {
  name: string;    // 目录名称（路径末段）
  dirPath: string; // 父目录的绝对路径
}) => boolean;
```

返回 `true` 表示**保留**该目录并继续递归；返回 `false` 表示**跳过**。

**示例 — 跳过隐藏目录和 `node_modules`：**

```ts
const treeify = new PathTreeify({
  base: '/your/project',
  filter: ({ name }) => !name.startsWith('.') && name !== 'node_modules',
});
```

---

### `buildByDirPaths(paths: string[]): PathTreeNode`

扫描给定的相对目录路径（以 `base` 为基准解析），返回一个合成根节点 `PathTreeNode`，其 `children` 即为你请求的顶层节点。

```ts
const root = treeify.buildByDirPaths(['src', 'docs']);
```

- `paths` 中的每一项都必须是相对于 `base` 的有效可访问目录。
- 前后多余的斜杠会被自动去除。
- 若任意路径不存在或不是目录，则抛出错误。

---

### `getPathBy(node: PathTreeNode): { relative: string; absolute: string }`

沿节点的 `parent` 链向上还原完整路径。

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
  parent:   PathTreeNode | null; // 仅合成根节点为 null
  value:    string;              // 当前节点的目录名
  children: PathTreeNode[];
}
```

> ⚠️ **循环引用** — `parent` 指向树的上层节点。若需要序列化结果，请使用 `JSON.stringify` 的替换函数，或借助 `flatted` 等库处理循环引用。

---

## 示例

### 扫描整个目录

```ts
import { PathTreeify } from 'path-treeify';
import { readdirSync } from 'fs';

const base = '/your/project';
const treeify = new PathTreeify({ base });

// 获取所有顶级目录
const topLevel = readdirSync(base, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

const tree = treeify.buildByDirPaths(topLevel);
```

### 遍历时获取绝对路径

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

### CommonJS 用法

```js
const { PathTreeify } = require('path-treeify');

const treeify = new PathTreeify({ base: __dirname });
const tree = treeify.buildByDirPaths(['src']);
```

---

## 许可证

[MIT](https://github.com/isaaxite/path-treeify/blob/main/LICENSE) © [isaaxite](https://github.com/isaaxite)
