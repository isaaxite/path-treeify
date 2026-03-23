import test from 'ava';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join, resolve, sep } from 'path';
import { PathTreeify, PathTreeNode, PathTreeNodeType } from '../dist/index.mjs';

// ─────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────

/**
 * Creates a temporary directory/file tree for testing.
 * Pass null as the value to create a file; pass an object to create a directory.
 */
function createTempTree(structure, root) {
  mkdirSync(root, { recursive: true });

  function create(base, node) {
    for (const [name, children] of Object.entries(node)) {
      const fullPath = join(base, name);
      if (children === null) {
        writeFileSync(fullPath, '');
      } else if (typeof children === 'object') {
        mkdirSync(fullPath, { recursive: true });
        create(fullPath, children);
      }
    }
  }

  create(root, structure);
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

let tmpRoot;
let cleanup;

test.before(() => {
  tmpRoot = join('/tmp', `path-treeify-test-${Date.now()}`);
  ({ cleanup } = createTempTree(
    {
      src: {
        components: {},
        utils: {},
        hooks: {},
      },
      public: {},
      dist: {
        assets: {},
      },
      node_modules: {
        '.cache': {},
      },
      'README.md': null,
      'logo.png': null,
    },
    tmpRoot
  ));
});

test.after.always(() => cleanup?.());

// ─────────────────────────────────────────────
// Constructor — base validation
// ─────────────────────────────────────────────

test('constructor — throws when base is missing', t => {
  const err = t.throws(() => new PathTreeify({}));
  t.regex(err.message, /not a valid path/i);
});

test('constructor — throws when base path does not exist', t => {
  const err = t.throws(() => new PathTreeify({ base: '/this/does/not/exist' }));
  t.regex(err.message, /not a valid path/i);
});

test('constructor — throws when base points to a file', t => {
  const err = t.throws(() => new PathTreeify({ base: join(tmpRoot, 'README.md') }));
  t.regex(err.message, /not a dirPath/i);
});

test('constructor — succeeds with a valid directory', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot }));
});

// ─────────────────────────────────────────────
// Constructor — filter validation
// ─────────────────────────────────────────────

test('constructor — throws when filter is not a function', t => {
  // @ts-ignore intentional bad input
  const err = t.throws(() => new PathTreeify({ base: tmpRoot, filter: 'bad' }));
  t.regex(err.message, /filter must be a function/i);
});

test('constructor — accepts a zero-parameter arrow function as filter', t => {
  // Old code rejected () => true (filter.length !== 1); new code accepts it
  t.notThrows(() => new PathTreeify({ base: tmpRoot, filter: () => true }));
});

test('constructor — accepts a valid one-parameter filter', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot, filter: (_opts) => true }));
});

test('constructor — accepts filter that returns false', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot, filter: () => false }));
});

// ─────────────────────────────────────────────
// Constructor — fileVisible option
// ─────────────────────────────────────────────

test('constructor — accepts fileVisible: true', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot, fileVisible: true }));
});

test('constructor — accepts fileVisible: false (explicit)', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot, fileVisible: false }));
});

// ─────────────────────────────────────────────
// PathTreeNodeType enum
// ─────────────────────────────────────────────

test('PathTreeNodeType — enum values are as expected', t => {
  t.is(PathTreeNodeType.Dir, 'dir');
  t.is(PathTreeNodeType.File, 'file');
  t.is(PathTreeNodeType.Unknown, 'unknown');
});

// ─────────────────────────────────────────────
// PathTreeNode — default state
// ─────────────────────────────────────────────

test('PathTreeNode — default type is Unknown', t => {
  const node = new PathTreeNode();
  t.is(node.type, PathTreeNodeType.Unknown);
  t.is(node.parent, null);
  t.is(node.value, '');
  t.deepEqual(node.children, []);
});

test('PathTreeNode.getPath() — returns empty string for root node', t => {
  const node = new PathTreeNode();
  t.is(node.getPath(), '');
});

test('PathTreeNode.getPath() — returns value for single-level node', t => {
  const root = new PathTreeNode();
  const child = new PathTreeNode();
  child.value = 'src';
  child.parent = root;
  t.is(child.getPath(), 'src');
});

test('PathTreeNode.getPath() — returns sep-joined path for nested node', t => {
  const root = new PathTreeNode();
  const child = new PathTreeNode();
  child.value = 'src';
  child.parent = root;
  const grandchild = new PathTreeNode();
  grandchild.value = 'components';
  grandchild.parent = child;
  t.is(grandchild.getPath(), `src${sep}components`);
});

// ─────────────────────────────────────────────
// build() — structure
// ─────────────────────────────────────────────

test('build() — returns a root node with null parent', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  t.truthy(root);
  t.is(root.parent, null);
});

test('build() — top-level children include only directories by default', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const topNames = pt.build().children.map(n => n.value);
  t.false(topNames.includes('README.md'));
  t.false(topNames.includes('logo.png'));
  t.true(topNames.includes('src'));
  t.true(topNames.includes('public'));
  t.true(topNames.includes('dist'));
  t.true(topNames.includes('node_modules'));
});

test('build() — all top-level dir nodes have type Dir', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  for (const child of root.children) {
    t.is(child.type, PathTreeNodeType.Dir);
  }
});

test('build() — nested children are built recursively', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  const src = root.children.find(n => n.value === 'src');
  t.truthy(src);
  t.deepEqual(src.children.map(n => n.value).sort(), ['components', 'hooks', 'utils']);
});

test('build() — each child has correct parent back-reference', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  for (const child of root.children) {
    t.is(child.parent, root);
    for (const grandchild of child.children) {
      t.is(grandchild.parent, child);
    }
  }
});

// ─────────────────────────────────────────────
// build() — with fileVisible
// ─────────────────────────────────────────────

test('fileVisible: true — files appear as leaf nodes at top level', t => {
  const pt = new PathTreeify({ base: tmpRoot, fileVisible: true });
  const topNames = pt.build().children.map(n => n.value);
  t.true(topNames.includes('README.md'));
  t.true(topNames.includes('logo.png'));
});

test('fileVisible: true — file nodes have type File', t => {
  const pt = new PathTreeify({ base: tmpRoot, fileVisible: true });
  const root = pt.build();
  const readme = root.children.find(n => n.value === 'README.md');
  t.truthy(readme);
  t.is(readme.type, PathTreeNodeType.File);
});

test('fileVisible: true — file nodes have no children', t => {
  const pt = new PathTreeify({ base: tmpRoot, fileVisible: true });
  const root = pt.build();
  const readme = root.children.find(n => n.value === 'README.md');
  t.deepEqual(readme.children, []);
});

test('fileVisible: true — directory nodes still have type Dir', t => {
  const pt = new PathTreeify({ base: tmpRoot, fileVisible: true });
  const root = pt.build();
  const src = root.children.find(n => n.value === 'src');
  t.is(src.type, PathTreeNodeType.Dir);
});

test('fileVisible: false (default) — file nodes are absent', t => {
  const pt = new PathTreeify({ base: tmpRoot, fileVisible: false });
  const topNames = pt.build().children.map(n => n.value);
  t.false(topNames.includes('README.md'));
});

// ─────────────────────────────────────────────
// build() — instance-level filter
// ─────────────────────────────────────────────

test('build() — instance filter excludes matching top-level dirs', t => {
  const pt = new PathTreeify({ base: tmpRoot, filter: ({ name }) => name !== 'node_modules' });
  const topNames = pt.build().children.map(n => n.value);
  t.false(topNames.includes('node_modules'));
  t.true(topNames.includes('src'));
});

test('build() — instance filter is applied recursively', t => {
  const pt = new PathTreeify({ base: tmpRoot, filter: ({ name }) => name !== 'hooks' });
  const root = pt.build();
  const src = root.children.find(n => n.value === 'src');
  const srcChildNames = src.children.map(n => n.value);
  t.false(srcChildNames.includes('hooks'));
  t.true(srcChildNames.includes('components'));
});

test('build() — instance filter combined with fileVisible', t => {
  const pt = new PathTreeify({
    base: tmpRoot,
    fileVisible: true,
    filter: ({ name }) => !name.endsWith('.png'),
  });
  const topNames = pt.build().children.map(n => n.value);
  t.false(topNames.includes('logo.png'));
  t.true(topNames.includes('README.md')); // .md is not excluded
});

// ─────────────────────────────────────────────
// buildBy(string[])
// ─────────────────────────────────────────────

test('buildBy(string[]) — returns only requested top-level dirs', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy(['src', 'public']);
  t.deepEqual(root.children.map(n => n.value).sort(), ['public', 'src']);
});

test('buildBy(string[]) — builds subtrees under selected dirs', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy(['src']);
  const src = root.children.find(n => n.value === 'src');
  t.deepEqual(src.children.map(n => n.value).sort(), ['components', 'hooks', 'utils']);
});

test('buildBy(string[]) — top-level nodes have type Dir', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy(['src', 'dist']);
  for (const child of root.children) {
    t.is(child.type, PathTreeNodeType.Dir);
  }
});

test('buildBy(string[]) — strips leading/trailing slashes (posix style)', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy(['/src/', '/public/']);
  const topNames = root.children.map(n => n.value).sort();
  t.true(topNames.includes('src'));
  t.true(topNames.includes('public'));
});

test('buildBy(string[]) — strips backslashes (windows style)', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy(['\\src\\', '\\public\\']);
  const topNames = root.children.map(n => n.value).sort();
  t.true(topNames.includes('src'));
  t.true(topNames.includes('public'));
});

test('buildBy(string[]) — strips mixed slashes', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy(['/src\\']);
  t.true(root.children.map(n => n.value).includes('src'));
});

test('buildBy(string[]) — empty array produces root with no children', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  t.is(pt.buildBy([]).children.length, 0);
});

test('buildBy(string[]) — entries that reduce to empty string are ignored', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  // '///' reduces to '' after formatting and must be silently dropped
  const root = pt.buildBy(['///', 'src']);
  t.deepEqual(root.children.map(n => n.value), ['src']);
});

test('buildBy(string[]) — throws when a segment does not exist', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const err = t.throws(() => pt.buildBy(['non-existent-dir']));
  t.regex(err.message, /does not exist|not accessible/i);
});

test('buildBy(string[]) — throws when a segment points to a file (fileVisible: false)', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const err = t.throws(() => pt.buildBy(['README.md']));
  t.regex(err.message, /not a directory/i);
});

test('buildBy(string[]) — accepts a file segment when fileVisible: true', t => {
  const pt = new PathTreeify({ base: tmpRoot, fileVisible: true });
  t.notThrows(() => pt.buildBy(['README.md']));
  const root = pt.buildBy(['README.md']);
  const node = root.children.find(n => n.value === 'README.md');
  t.is(node.type, PathTreeNodeType.File);
});

// ─────────────────────────────────────────────
// buildBy(filter function)
// ─────────────────────────────────────────────

test('buildBy(fn) — includes only dirs matching predicate', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy(name => name === 'src' || name === 'dist');
  t.deepEqual(root.children.map(n => n.value).sort(), ['dist', 'src']);
});

test('buildBy(fn) — predicate returning false for all produces empty root', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  t.is(pt.buildBy(() => false).children.length, 0);
});

test('buildBy(fn) — predicate returning true for all equals build()', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const fromBuild   = pt.build().children.map(n => n.value).sort();
  const fromBuildBy = pt.buildBy(() => true).children.map(n => n.value).sort();
  t.deepEqual(fromBuild, fromBuildBy);
});

test('buildBy(fn) — predicate receives the entry name as argument', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const seen = [];
  pt.buildBy(name => { seen.push(name); return false; });
  t.true(seen.includes('src'));
  t.true(seen.includes('dist'));
});

// ─────────────────────────────────────────────
// buildBy — invalid argument
// ─────────────────────────────────────────────

test('buildBy — throws TypeError for number argument', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const err = t.throws(() => pt.buildBy(42));
  t.regex(err.message, /expected an array.*filter function/i);
});

test('buildBy — throws TypeError for null argument', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const err = t.throws(() => pt.buildBy(null));
  t.regex(err.message, /expected an array.*filter function/i);
});

test('buildBy — throws TypeError for object argument', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const err = t.throws(() => pt.buildBy({}));
  t.regex(err.message, /expected an array.*filter function/i);
});

test('buildBy — throws TypeError for string argument', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const err = t.throws(() => pt.buildBy('src'));
  t.regex(err.message, /expected an array.*filter function/i);
});

// ─────────────────────────────────────────────
// getPathBy()
// ─────────────────────────────────────────────

test('getPathBy() — correct relative path for top-level node', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  const src = root.children.find(n => n.value === 'src');
  const { relative, absolute } = pt.getPathBy(src);
  t.is(relative, 'src');
  t.is(absolute, resolve(tmpRoot, 'src'));
});

test('getPathBy() — correct relative path for nested node', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  const src = root.children.find(n => n.value === 'src');
  const components = src.children.find(n => n.value === 'components');
  const { relative, absolute } = pt.getPathBy(components);
  t.is(relative, `src${sep}components`);
  t.is(absolute, resolve(tmpRoot, 'src', 'components'));
});

test('getPathBy() — absolute path exists on disk', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  const dist = root.children.find(n => n.value === 'dist');
  const assets = dist.children.find(n => n.value === 'assets');
  t.true(existsSync(pt.getPathBy(assets).absolute));
});

test('getPathBy() — correct path for file node when fileVisible: true', t => {
  const pt = new PathTreeify({ base: tmpRoot, fileVisible: true });
  const root = pt.build();
  const readme = root.children.find(n => n.value === 'README.md');
  const { relative, absolute } = pt.getPathBy(readme);
  t.is(relative, 'README.md');
  t.is(absolute, resolve(tmpRoot, 'README.md'));
});

// ─────────────────────────────────────────────
// Edge cases — empty base directory
// ─────────────────────────────────────────────

test('build() — empty base returns root with no children', t => {
  const emptyDir = join('/tmp', `path-treeify-empty-${Date.now()}`);
  mkdirSync(emptyDir, { recursive: true });
  try {
    t.is(new PathTreeify({ base: emptyDir }).build().children.length, 0);
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────
// Edge cases — deeply nested single branch
// ─────────────────────────────────────────────

test('build() — deeply nested branch has correct parent chain', t => {
  const deepRoot = join('/tmp', `path-treeify-deep-${Date.now()}`);
  mkdirSync(join(deepRoot, 'a', 'b', 'c'), { recursive: true });
  try {
    const root = new PathTreeify({ base: deepRoot }).build();
    const a = root.children.find(n => n.value === 'a');
    const b = a?.children.find(n => n.value === 'b');
    const c = b?.children.find(n => n.value === 'c');
    t.truthy(a); t.truthy(b); t.truthy(c);
    t.is(a.parent, root);
    t.is(b.parent, a);
    t.is(c.parent, b);
  } finally {
    rmSync(deepRoot, { recursive: true, force: true });
  }
});

test('build() — deeply nested branch getPath returns full relative path', t => {
  const deepRoot = join('/tmp', `path-treeify-deep2-${Date.now()}`);
  mkdirSync(join(deepRoot, 'a', 'b', 'c'), { recursive: true });
  try {
    const pt = new PathTreeify({ base: deepRoot });
    const root = pt.build();
    const a = root.children.find(n => n.value === 'a');
    const b = a?.children.find(n => n.value === 'b');
    const c = b?.children.find(n => n.value === 'c');
    t.is(pt.getPathBy(c).relative, `a${sep}b${sep}c`);
  } finally {
    rmSync(deepRoot, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────
// Edge cases — fileVisible with mixed content
// ─────────────────────────────────────────────

test('fileVisible: true — mixed dir/file tree has both types as siblings', t => {
  const mixedRoot = join('/tmp', `path-treeify-mixed-${Date.now()}`);
  createTempTree({ subdir: {}, 'file.txt': null }, mixedRoot);
  try {
    const root = new PathTreeify({ base: mixedRoot, fileVisible: true }).build();
    const dir  = root.children.find(n => n.value === 'subdir');
    const file = root.children.find(n => n.value === 'file.txt');
    t.is(dir.type,  PathTreeNodeType.Dir);
    t.is(file.type, PathTreeNodeType.File);
  } finally {
    rmSync(mixedRoot, { recursive: true, force: true });
  }
});
