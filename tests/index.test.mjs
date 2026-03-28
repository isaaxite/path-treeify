import test from 'ava';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join, resolve, sep } from 'path';
import { PathTreeify, PathTreeNodeKind } from '../dist/index.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Declaratively create a directory/file tree under `root`.
 * - object value  → directory (recurse)
 * - null value    → empty file
 */
function createTempTree(structure, root) {
  mkdirSync(root, { recursive: true });

  function create(base, node) {
    for (const [name, children] of Object.entries(node)) {
      const fullPath = join(base, name);
      if (children === null) {
        writeFileSync(fullPath, '');
      } else {
        mkdirSync(fullPath, { recursive: true });
        create(fullPath, children);
      }
    }
  }

  create(root, structure);
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/** Shared fixture used by most tests */
let tmpRoot;
let cleanup;

test.before(() => {
  tmpRoot = join('/tmp', `path-treeify-test-${Date.now()}`);
  ({ cleanup } = createTempTree(
    {
      src: {
        components: { Button: {}, Input: {} },
        utils: {},
        hooks: {},
      },
      public: {},
      dist: { assets: {} },
      node_modules: { '.cache': {} },
      'README.md': null,
      'logo.png': null,
    },
    tmpRoot
  ));
});

test.after.always(() => cleanup?.());

// ─────────────────────────────────────────────────────────────────────────────
// PathTreeNodeKind enum
// ─────────────────────────────────────────────────────────────────────────────

test('PathTreeNodeKind — has correct string values', t => {
  t.is(PathTreeNodeKind.Dir,     'dir');
  t.is(PathTreeNodeKind.File,    'file');
  t.is(PathTreeNodeKind.Unknown, 'unknown');
});

// ─────────────────────────────────────────────────────────────────────────────
// Constructor — base validation
// ─────────────────────────────────────────────────────────────────────────────

test('constructor — throws when base is omitted', t => {
  const err = t.throws(() => new PathTreeify({}));
  t.regex(err.message, /not a valid path/i);
});

test('constructor — throws when base is an empty string', t => {
  const err = t.throws(() => new PathTreeify({ base: '' }));
  t.regex(err.message, /not a valid path/i);
});

test('constructor — throws when base does not exist', t => {
  const err = t.throws(() => new PathTreeify({ base: '/no/such/path' }));
  t.regex(err.message, /not a valid path/i);
});

test('constructor — throws when base points to a file', t => {
  const err = t.throws(() => new PathTreeify({ base: join(tmpRoot, 'README.md') }));
  t.regex(err.message, /not a dirPath/i);
});

test('constructor — succeeds with a valid directory', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot }));
});

// ─────────────────────────────────────────────────────────────────────────────
// Constructor — filter validation
// ─────────────────────────────────────────────────────────────────────────────

test('constructor — throws when filter is a string', t => {
  // @ts-ignore intentional bad input
  const err = t.throws(() => new PathTreeify({ base: tmpRoot, filter: 'bad' }));
  t.regex(err.message, /filter must be a function/i);
});

test('constructor — throws when filter is a number', t => {
  // @ts-ignore
  const err = t.throws(() => new PathTreeify({ base: tmpRoot, filter: 42 }));
  t.regex(err.message, /filter must be a function/i);
});

test('constructor — throws when filter is null', t => {
  // @ts-ignore
  const err = t.throws(() => new PathTreeify({ base: tmpRoot, filter: null }));
  t.regex(err.message, /filter must be a function/i);
});

test('constructor — accepts zero-parameter filter', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot, filter: () => true }));
});

test('constructor — accepts one-parameter filter', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot, filter: (_) => true }));
});

test('constructor — accepts filter that always returns false', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot, filter: () => false }));
});

// ─────────────────────────────────────────────────────────────────────────────
// Constructor — fileVisible option
// ─────────────────────────────────────────────────────────────────────────────

test('constructor — accepts fileVisible: true', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot, fileVisible: true }));
});

test('constructor — accepts fileVisible: false', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot, fileVisible: false }));
});

// ─────────────────────────────────────────────────────────────────────────────
// Constructor — usePathCache option
// ─────────────────────────────────────────────────────────────────────────────

test('constructor — accepts usePathCache: true', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot, usePathCache: true }));
});

test('constructor — accepts usePathCache: false', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot, usePathCache: false }));
});

// ─────────────────────────────────────────────────────────────────────────────
// build() — root node shape
// ─────────────────────────────────────────────────────────────────────────────

test('build() — root parent is null', t => {
  t.is(new PathTreeify({ base: tmpRoot }).build().parent, null);
});

test('build() — root value is base', t => {
  t.is(new PathTreeify({ base: tmpRoot }).build().value, tmpRoot);
});

test('build() — root type is Dir', t => {
  t.is(new PathTreeify({ base: tmpRoot }).build().type, PathTreeNodeKind.Dir);
});

test('build() — root children is an array', t => {
  t.true(Array.isArray(new PathTreeify({ base: tmpRoot }).build().children));
});

test('build() — root depth is 0', t => {
  t.is(new PathTreeify({ base: tmpRoot }).build().depth, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// build() — depth field
// ─────────────────────────────────────────────────────────────────────────────

test('build() — top-level children have depth 1', t => {
  for (const child of new PathTreeify({ base: tmpRoot }).build().children) {
    t.is(child.depth, 1);
  }
});

test('build() — grandchildren have depth 2', t => {
  const root = new PathTreeify({ base: tmpRoot }).build();
  const src  = root.children.find(n => n.value === 'src');
  for (const grandchild of src.children) {
    t.is(grandchild.depth, 2);
  }
});

test('build() — depth increments correctly through 3 levels', t => {
  const deepRoot = join('/tmp', `pt-depth-${Date.now()}`);
  mkdirSync(join(deepRoot, 'a', 'b', 'c'), { recursive: true });
  try {
    const root = new PathTreeify({ base: deepRoot }).build();
    const a = root.children.find(n => n.value === 'a');
    const b = a.children.find(n => n.value === 'b');
    const c = b.children.find(n => n.value === 'c');
    t.is(root.depth, 0);
    t.is(a.depth, 1);
    t.is(b.depth, 2);
    t.is(c.depth, 3);
  } finally {
    rmSync(deepRoot, { recursive: true, force: true });
  }
});

test('buildBy([]) — top-level nodes have depth 1', t => {
  for (const child of new PathTreeify({ base: tmpRoot }).buildBy(['src', 'dist']).children) {
    t.is(child.depth, 1);
  }
});

test('fileVisible: true — file nodes have correct depth', t => {
  const root   = new PathTreeify({ base: tmpRoot, fileVisible: true }).build();
  const readme = root.children.find(n => n.value === 'README.md');
  t.is(readme.depth, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// build() — directory-only mode (default)
// ─────────────────────────────────────────────────────────────────────────────

test('build() — top-level files are excluded by default', t => {
  const topNames = new PathTreeify({ base: tmpRoot }).build().children.map(n => n.value);
  t.false(topNames.includes('README.md'));
  t.false(topNames.includes('logo.png'));
});

test('build() — top-level directories are all present', t => {
  const topNames = new PathTreeify({ base: tmpRoot }).build().children.map(n => n.value);
  t.true(topNames.includes('src'));
  t.true(topNames.includes('public'));
  t.true(topNames.includes('dist'));
  t.true(topNames.includes('node_modules'));
});

test('build() — all top-level dir nodes have type Dir', t => {
  for (const child of new PathTreeify({ base: tmpRoot }).build().children) {
    t.is(child.type, PathTreeNodeKind.Dir);
  }
});

test('build() — nested children are built recursively', t => {
  const root = new PathTreeify({ base: tmpRoot }).build();
  const src   = root.children.find(n => n.value === 'src');
  t.deepEqual(src.children.map(n => n.value).sort(), ['components', 'hooks', 'utils']);

  const components = src.children.find(n => n.value === 'components');
  t.deepEqual(components.children.map(n => n.value).sort(), ['Button', 'Input']);
});

test('build() — each node has a correct parent back-reference', t => {
  const root = new PathTreeify({ base: tmpRoot }).build();
  for (const child of root.children) {
    t.is(child.parent, root);
    for (const grandchild of child.children) {
      t.is(grandchild.parent, child);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// build() — fileVisible: true
// ─────────────────────────────────────────────────────────────────────────────

test('fileVisible: true — files appear at top level', t => {
  const topNames = new PathTreeify({ base: tmpRoot, fileVisible: true })
    .build().children.map(n => n.value);
  t.true(topNames.includes('README.md'));
  t.true(topNames.includes('logo.png'));
});

test('fileVisible: true — file nodes have type File', t => {
  const root   = new PathTreeify({ base: tmpRoot, fileVisible: true }).build();
  const readme = root.children.find(n => n.value === 'README.md');
  t.is(readme.type, PathTreeNodeKind.File);
});

test('fileVisible: true — file nodes have no children', t => {
  const root   = new PathTreeify({ base: tmpRoot, fileVisible: true }).build();
  const readme = root.children.find(n => n.value === 'README.md');
  t.deepEqual(readme.children, []);
});

test('fileVisible: true — directory nodes still have type Dir', t => {
  const root = new PathTreeify({ base: tmpRoot, fileVisible: true }).build();
  const src  = root.children.find(n => n.value === 'src');
  t.is(src.type, PathTreeNodeKind.Dir);
});

test('fileVisible: true — dir nodes still recurse correctly', t => {
  const root = new PathTreeify({ base: tmpRoot, fileVisible: true }).build();
  const src  = root.children.find(n => n.value === 'src');
  t.true(src.children.length > 0);
});

test('fileVisible: false (explicit) — files remain excluded', t => {
  const topNames = new PathTreeify({ base: tmpRoot, fileVisible: false })
    .build().children.map(n => n.value);
  t.false(topNames.includes('README.md'));
});

test('fileVisible: true — mixed dir/file siblings both typed correctly', t => {
  const mixedRoot = join('/tmp', `pt-mixed-${Date.now()}`);
  createTempTree({ subdir: {}, 'file.txt': null }, mixedRoot);
  try {
    const root = new PathTreeify({ base: mixedRoot, fileVisible: true }).build();
    t.is(root.children.find(n => n.value === 'subdir').type, PathTreeNodeKind.Dir);
    t.is(root.children.find(n => n.value === 'file.txt').type, PathTreeNodeKind.File);
  } finally {
    rmSync(mixedRoot, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// build() — instance-level filter
// ─────────────────────────────────────────────────────────────────────────────

test('build() — filter excludes at top level', t => {
  const topNames = new PathTreeify({ base: tmpRoot, filter: ({ name }) => name !== 'node_modules' })
    .build().children.map(n => n.value);
  t.false(topNames.includes('node_modules'));
  t.true(topNames.includes('src'));
});

test('build() — filter is applied recursively', t => {
  const src = new PathTreeify({ base: tmpRoot, filter: ({ name }) => name !== 'hooks' })
    .build().children.find(n => n.value === 'src');
  t.false(src.children.map(n => n.value).includes('hooks'));
  t.true(src.children.map(n => n.value).includes('components'));
});

test('build() — filter receives correct name and dirPath params', t => {
  const calls = [];
  new PathTreeify({
    base: tmpRoot,
    filter: ({ name, dirPath }) => { calls.push({ name, dirPath }); return true; },
  }).build();

  // Every call must have a non-empty name and a dirPath that starts with tmpRoot
  for (const call of calls) {
    t.is(typeof call.name, 'string');
    t.true(call.name.length > 0);
    t.true(call.dirPath.startsWith(tmpRoot));
  }
});

test('build() — filter combined with fileVisible: true filters files too', t => {
  const topNames = new PathTreeify({
    base: tmpRoot,
    fileVisible: true,
    filter: ({ name }) => !name.endsWith('.png'),
  }).build().children.map(n => n.value);
  t.false(topNames.includes('logo.png'));
  t.true(topNames.includes('README.md'));
});

// ─────────────────────────────────────────────────────────────────────────────
// buildBy(string[])
// ─────────────────────────────────────────────────────────────────────────────

test('buildBy([]) — returns only requested top-level dirs', t => {
  const topNames = new PathTreeify({ base: tmpRoot })
    .buildBy(['src', 'public']).children.map(n => n.value).sort();
  t.deepEqual(topNames, ['public', 'src']);
});

test('buildBy([]) — builds full subtrees under requested dirs', t => {
  const src = new PathTreeify({ base: tmpRoot })
    .buildBy(['src']).children.find(n => n.value === 'src');
  t.deepEqual(src.children.map(n => n.value).sort(), ['components', 'hooks', 'utils']);
});

test('buildBy([]) — top-level nodes have type Dir', t => {
  for (const child of new PathTreeify({ base: tmpRoot }).buildBy(['src', 'dist']).children) {
    t.is(child.type, PathTreeNodeKind.Dir);
  }
});

test('buildBy([]) — parent references are correct', t => {
  const root = new PathTreeify({ base: tmpRoot }).buildBy(['src', 'dist']);
  for (const child of root.children) {
    t.is(child.parent, root);
  }
});

test('buildBy([]) — strips leading/trailing posix slashes', t => {
  const topNames = new PathTreeify({ base: tmpRoot })
    .buildBy(['/src/', '/public/']).children.map(n => n.value).sort();
  t.true(topNames.includes('src'));
  t.true(topNames.includes('public'));
});

test('buildBy([]) — entries that reduce to empty string are silently dropped', t => {
  // '///' → no segments after split/filter → dropped
  const root = new PathTreeify({ base: tmpRoot }).buildBy(['///', 'src']);
  t.deepEqual(root.children.map(n => n.value), ['src']);
});

test('buildBy([]) — empty array produces root with no children', t => {
  t.is(new PathTreeify({ base: tmpRoot }).buildBy([]).children.length, 0);
});

test('buildBy([]) — throws when segment does not exist', t => {
  const err = t.throws(() => new PathTreeify({ base: tmpRoot }).buildBy(['does-not-exist']));
  t.regex(err.message, /does not exist|not accessible/i);
});

test('buildBy([]) — throws when segment is a file and fileVisible is false', t => {
  const err = t.throws(() => new PathTreeify({ base: tmpRoot }).buildBy(['README.md']));
  t.regex(err.message, /not a directory/i);
});

test('buildBy([]) — accepts a file segment when fileVisible: true', t => {
  const pt = new PathTreeify({ base: tmpRoot, fileVisible: true });
  t.notThrows(() => pt.buildBy(['README.md']));
  const node = pt.buildBy(['README.md']).children.find(n => n.value === 'README.md');
  t.is(node.type, PathTreeNodeKind.File);
  t.deepEqual(node.children, []);
});

test('buildBy([]) — backslash is treated as separator by formatSegments', t => {
  // formatSegments splits on /[/\\]/, so '\\src\\' → ['src'] → resolves correctly
  const root = new PathTreeify({ base: tmpRoot }).buildBy(['\\src\\']);
  t.true(root.children.map(n => n.value).includes('src'));
});

// ─────────────────────────────────────────────────────────────────────────────
// buildBy(fn)
// ─────────────────────────────────────────────────────────────────────────────

test('buildBy(fn) — includes only entries matching predicate', t => {
  const topNames = new PathTreeify({ base: tmpRoot })
    .buildBy(n => n === 'src' || n === 'dist').children.map(n => n.value).sort();
  t.deepEqual(topNames, ['dist', 'src']);
});

test('buildBy(fn) — predicate returning false for all yields empty root', t => {
  t.is(new PathTreeify({ base: tmpRoot }).buildBy(() => false).children.length, 0);
});

test('buildBy(fn) — predicate returning true for all matches build()', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  t.deepEqual(
    pt.buildBy(() => true).children.map(n => n.value).sort(),
    pt.build().children.map(n => n.value).sort()
  );
});

test('buildBy(fn) — predicate receives entry name as string', t => {
  const seen = [];
  new PathTreeify({ base: tmpRoot }).buildBy(name => { seen.push(name); return false; });
  t.true(seen.every(n => typeof n === 'string'));
  t.true(seen.includes('src'));
  t.true(seen.includes('dist'));
});

test('buildBy(fn) — predicate does not receive files when fileVisible is false', t => {
  const seen = [];
  new PathTreeify({ base: tmpRoot }).buildBy(name => { seen.push(name); return false; });
  t.false(seen.includes('README.md'));
  t.false(seen.includes('logo.png'));
});

test('buildBy(fn) — predicate receives files when fileVisible is true', t => {
  const seen = [];
  new PathTreeify({ base: tmpRoot, fileVisible: true })
    .buildBy(name => { seen.push(name); return false; });
  t.true(seen.includes('README.md'));
});

// ─────────────────────────────────────────────────────────────────────────────
// buildBy — invalid argument types
// ─────────────────────────────────────────────────────────────────────────────

const invalidArgs = [42, null, {}, 'src', true, undefined];
for (const arg of invalidArgs) {
  test(`buildBy — throws TypeError for argument: ${JSON.stringify(arg)}`, t => {
    const err = t.throws(() => new PathTreeify({ base: tmpRoot }).buildBy(arg));
    t.regex(err.message, /expected an array.*filter function/i);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PathTreeNode.getPath()
// ─────────────────────────────────────────────────────────────────────────────

test('getPath() — root node returns empty relative and base as absolute', t => {
  const root = new PathTreeify({ base: tmpRoot }).build();
  const { relative, absolute } = root.getPath();
  t.is(relative, '');
  t.is(absolute, resolve(tmpRoot, ''));
});

test('getPath() — top-level node returns its name as relative', t => {
  const root = new PathTreeify({ base: tmpRoot }).build();
  const src  = root.children.find(n => n.value === 'src');
  const { relative, absolute } = src.getPath();
  t.is(relative, 'src');
  t.is(absolute, resolve(tmpRoot, 'src'));
});

test('getPath() — nested node returns sep-joined relative path', t => {
  const root       = new PathTreeify({ base: tmpRoot }).build();
  const src        = root.children.find(n => n.value === 'src');
  const components = src.children.find(n => n.value === 'components');
  const { relative, absolute } = components.getPath();
  t.is(relative, `src${sep}components`);
  t.is(absolute, resolve(tmpRoot, 'src', 'components'));
});

test('getPath() — 3-level deep node returns correct path', t => {
  const deepRoot = join('/tmp', `pt-deep-${Date.now()}`);
  mkdirSync(join(deepRoot, 'a', 'b', 'c'), { recursive: true });
  try {
    const root = new PathTreeify({ base: deepRoot }).build();
    const a = root.children.find(n => n.value === 'a');
    const b = a.children.find(n => n.value === 'b');
    const c = b.children.find(n => n.value === 'c');
    const { relative, absolute } = c.getPath();
    t.is(relative, `a${sep}b${sep}c`);
    t.is(absolute, resolve(deepRoot, 'a', 'b', 'c'));
  } finally {
    rmSync(deepRoot, { recursive: true, force: true });
  }
});

test('getPath() — absolute path exists on disk', t => {
  const root   = new PathTreeify({ base: tmpRoot }).build();
  const dist   = root.children.find(n => n.value === 'dist');
  const assets = dist.children.find(n => n.value === 'assets');
  t.true(existsSync(assets.getPath().absolute));
});

test('getPath() — file node returns correct path when fileVisible: true', t => {
  const root   = new PathTreeify({ base: tmpRoot, fileVisible: true }).build();
  const readme = root.children.find(n => n.value === 'README.md');
  const { relative, absolute } = readme.getPath();
  t.is(relative, 'README.md');
  t.is(absolute, resolve(tmpRoot, 'README.md'));
});

test('getPath() — all siblings return correct distinct paths', t => {
  // Verifies that every sibling, not just the first, resolves its path correctly
  const root       = new PathTreeify({ base: tmpRoot }).build();
  const src        = root.children.find(n => n.value === 'src');
  const components = src.children.find(n => n.value === 'components');
  const hooks      = src.children.find(n => n.value === 'hooks');
  const utils      = src.children.find(n => n.value === 'utils');
  t.is(components.getPath().relative, `src${sep}components`);
  t.is(hooks.getPath().relative,      `src${sep}hooks`);
  t.is(utils.getPath().relative,      `src${sep}utils`);
});

test('getPath() — node from buildBy returns same path as from build()', t => {
  const pt     = new PathTreeify({ base: tmpRoot });
  const viaAll = pt.build().children.find(n => n.value === 'src');
  const viaBy  = pt.buildBy(['src']).children.find(n => n.value === 'src');
  t.deepEqual(viaAll.getPath(), viaBy.getPath());
});

// ─────────────────────────────────────────────────────────────────────────────
// PathTreeNode.getPath() — usePathCache: true
// ─────────────────────────────────────────────────────────────────────────────

test('usePathCache: true — getPath() returns correct paths', t => {
  const root = new PathTreeify({ base: tmpRoot, usePathCache: true }).build();
  const src  = root.children.find(n => n.value === 'src');
  const { relative, absolute } = src.getPath();
  t.is(relative, 'src');
  t.is(absolute, resolve(tmpRoot, 'src'));
});

test('usePathCache: true — getPath() returns same object reference on repeated calls', t => {
  const root   = new PathTreeify({ base: tmpRoot, usePathCache: true }).build();
  const src    = root.children.find(n => n.value === 'src');
  const first  = src.getPath();
  const second = src.getPath();
  // Same object reference because the result is cached after the first call
  t.is(first, second);
});

test('usePathCache: false — getPath() returns different object references each call', t => {
  const root   = new PathTreeify({ base: tmpRoot, usePathCache: false }).build();
  const src    = root.children.find(n => n.value === 'src');
  const first  = src.getPath();
  const second = src.getPath();
  // No caching — each call allocates a new result object
  t.not(first, second);
});

test('usePathCache: true — nested node returns correct path', t => {
  const root       = new PathTreeify({ base: tmpRoot, usePathCache: true }).build();
  const src        = root.children.find(n => n.value === 'src');
  const components = src.children.find(n => n.value === 'components');
  const { relative, absolute } = components.getPath();
  t.is(relative, `src${sep}components`);
  t.is(absolute, resolve(tmpRoot, 'src', 'components'));
});

test('usePathCache: true — root node returns empty relative', t => {
  const root = new PathTreeify({ base: tmpRoot, usePathCache: true }).build();
  const { relative, absolute } = root.getPath();
  t.is(relative, '');
  t.is(absolute, resolve(tmpRoot, ''));
});

test('usePathCache: true — produces same tree structure as without cache', t => {
  const pt       = new PathTreeify({ base: tmpRoot });
  const ptCached = new PathTreeify({ base: tmpRoot, usePathCache: true });
  t.deepEqual(
    pt.build().children.map(n => n.value).sort(),
    ptCached.build().children.map(n => n.value).sort()
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

test('build() — empty base directory returns root with no children', t => {
  const emptyDir = join('/tmp', `pt-empty-${Date.now()}`);
  mkdirSync(emptyDir, { recursive: true });
  try {
    t.is(new PathTreeify({ base: emptyDir }).build().children.length, 0);
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
});

test('build() — deeply nested branch has correct parent chain', t => {
  const deepRoot = join('/tmp', `pt-deep2-${Date.now()}`);
  mkdirSync(join(deepRoot, 'a', 'b', 'c'), { recursive: true });
  try {
    const root = new PathTreeify({ base: deepRoot }).build();
    const a = root.children.find(n => n.value === 'a');
    const b = a.children.find(n => n.value === 'b');
    const c = b.children.find(n => n.value === 'c');
    t.is(a.parent, root);
    t.is(b.parent, a);
    t.is(c.parent, b);
    t.is(c.children.length, 0);
  } finally {
    rmSync(deepRoot, { recursive: true, force: true });
  }
});

test('build() — sibling nodes do not share children arrays', t => {
  const root    = new PathTreeify({ base: tmpRoot }).build();
  const src     = root.children.find(n => n.value === 'src');
  const public_ = root.children.find(n => n.value === 'public');
  t.not(src.children, public_.children);
});

test('build() — multiple calls return independent trees', t => {
  const pt    = new PathTreeify({ base: tmpRoot });
  const root1 = pt.build();
  const root2 = pt.build();
  t.not(root1, root2);
  t.not(root1.children, root2.children);
});

test('buildBy([]) and build() — returned nodes are independent objects', t => {
  const pt      = new PathTreeify({ base: tmpRoot });
  const fromAll = pt.build().children.find(n => n.value === 'src');
  const fromBy  = pt.buildBy(['src']).children.find(n => n.value === 'src');
  t.not(fromAll, fromBy);
});
