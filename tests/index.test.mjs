import test from 'ava';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join, resolve, sep } from 'path';
import { PathTreeify } from '../dist/index.mjs';

// ─────────────────────────────────────────────
// Test fixture helpers
// ─────────────────────────────────────────────

/**
 * Creates a temporary directory tree for testing.
 * Returns the root path and a cleanup function.
 */
function createTempTree(structure, root) {
  mkdirSync(root, { recursive: true });

  function create(base, node) {
    for (const [name, children] of Object.entries(node)) {
      const fullPath = join(base, name);
      if (children === null) {
        // leaf file
        writeFileSync(fullPath, '');
      } else if (typeof children === 'object') {
        mkdirSync(fullPath, { recursive: true });
        create(fullPath, children);
      }
    }
  }

  create(root, structure);

  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
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
      'node_modules': {
        '.cache': {},
      },
      // a plain file (should be ignored by the tree builder)
      'README.md': null,
    },
    tmpRoot
  ));
});

test.after.always(() => {
  cleanup?.();
});

// ─────────────────────────────────────────────
// Constructor validation
// ─────────────────────────────────────────────

test('constructor — throws when base is missing', t => {
  const err = t.throws(() => new PathTreeify({}));
  t.truthy(err);
  t.regex(err.message, /not a valid path/i);
});

test('constructor — throws when base path does not exist', t => {
  const err = t.throws(() => new PathTreeify({ base: '/this/path/does/not/exist' }));
  t.truthy(err);
  t.regex(err.message, /not a valid path/i);
});

test('constructor — throws when base points to a file, not a directory', t => {
  const filePath = join(tmpRoot, 'README.md');
  const err = t.throws(() => new PathTreeify({ base: filePath }));
  t.truthy(err);
  t.regex(err.message, /not a dirPath/i);
});

test('constructor — succeeds with a valid directory', t => {
  t.notThrows(() => new PathTreeify({ base: tmpRoot }));
});

// ─────────────────────────────────────────────
// Filter validation
// ─────────────────────────────────────────────

test('constructor — throws when filter is not a function', t => {
  const err = t.throws(() => new PathTreeify({ base: tmpRoot, filter: 'not-a-function' }));
  t.truthy(err);
  t.regex(err.message, /filter must be a function/i);
});

test('constructor — throws when filter accepts wrong number of parameters', t => {
  const err = t.throws(() => new PathTreeify({ base: tmpRoot, filter: () => true }));
  t.truthy(err);
  t.regex(err.message, /exactly one parameter/i);
});

test('constructor — throws when filter does not return a boolean', t => {
  const err = t.throws(() => new PathTreeify({ base: tmpRoot, filter: (_opts) => 'yes' }));
  t.truthy(err);
  t.regex(err.message, /return a boolean/i);
});

test('constructor — accepts a valid filter function', t => {
  t.notThrows(() =>
    new PathTreeify({ base: tmpRoot, filter: (_opts) => true })
  );
});

// ─────────────────────────────────────────────
// build() — full tree
// ─────────────────────────────────────────────

test('build() — returns a root node', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  t.truthy(root);
});

test('build() — root node has no parent', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  t.is(root.parent, null);
});

test('build() — top-level children match only directories (no files)', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  const topNames = root.children.map(n => n.value).sort();
  // README.md is a file and must not appear
  t.false(topNames.includes('README.md'));
  // All well-known dirs must appear
  t.true(topNames.includes('src'));
  t.true(topNames.includes('public'));
  t.true(topNames.includes('dist'));
  t.true(topNames.includes('node_modules'));
});

test('build() — nested children are built recursively', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  const srcNode = root.children.find(n => n.value === 'src');
  t.truthy(srcNode);
  const srcChildNames = srcNode.children.map(n => n.value).sort();
  t.deepEqual(srcChildNames, ['components', 'hooks', 'utils']);
});

test('build() — each child node has a back-reference to its parent', t => {
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
// build() with filter
// ─────────────────────────────────────────────

test('build() — instance-level filter should exclude matching top-level dirs', t => {
  const pt = new PathTreeify({
    base: tmpRoot,
    filter: ({ name }) => name !== 'node_modules',
  });
  const root = pt.build();
  const topNames = root.children.map(n => n.value);
  t.false(topNames.includes('node_modules'), 'filter should exclude node_modules at top level');
  t.true(topNames.includes('src'));
});

test('build() — instance-level filter is applied recursively', t => {
  // exclude any dir named "hooks" at any depth
  const pt = new PathTreeify({
    base: tmpRoot,
    filter: ({ name }) => name !== 'hooks',
  });
  const root = pt.build();
  const srcNode = root.children.find(n => n.value === 'src');
  const srcChildNames = srcNode.children.map(n => n.value);
  t.false(srcChildNames.includes('hooks'));
  t.true(srcChildNames.includes('components'));
});

// ─────────────────────────────────────────────
// buildBy(string[])
// ─────────────────────────────────────────────

test('buildBy(string[]) — returns only requested top-level dirs', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy(['src', 'public']);
  const topNames = root.children.map(n => n.value).sort();
  t.deepEqual(topNames, ['public', 'src']);
});

test('buildBy(string[]) — still builds subtrees under selected dirs', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy(['src']);
  const srcNode = root.children.find(n => n.value === 'src');
  t.truthy(srcNode);
  const srcChildNames = srcNode.children.map(n => n.value).sort();
  t.deepEqual(srcChildNames, ['components', 'hooks', 'utils']);
});

test('buildBy(string[]) — should strip leading/trailing slashes before validation', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  // Should work: '/src/' means the same as 'src', slashes are cosmetic
  const root = pt.buildBy(['/src/', '/public/']);
  const topNames = root.children.map(n => n.value).sort();
  t.true(topNames.includes('src'), 'src should be present after slash stripping');
  t.true(topNames.includes('public'), 'public should be present after slash stripping');
});

test('buildBy(string[]) — throws when a relative path does not exist', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const err = t.throws(() => pt.buildBy(['non-existent-dir']));
  t.truthy(err);
  t.regex(err.message, /does not exist|not accessible/i);
});

test('buildBy(string[]) — throws when argument is not an array', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const err = t.throws(() => pt.buildBy('src'));
  t.truthy(err);
});

test('buildBy(string[]) — empty array produces root with no children', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy([]);
  t.is(root.children.length, 0);
});

// ─────────────────────────────────────────────
// buildBy(filter function)
// ─────────────────────────────────────────────

test('buildBy(fn) — includes only dirs matching predicate', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy(name => name === 'src' || name === 'dist');
  const topNames = root.children.map(n => n.value).sort();
  t.deepEqual(topNames, ['dist', 'src']);
});

test('buildBy(fn) — predicate returning false for all produces empty root', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.buildBy(() => false);
  t.is(root.children.length, 0);
});

test('buildBy(fn) — predicate returning true for all equals build()', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const fromBuild = pt.build();
  const fromBuildBy = pt.buildBy(() => true);
  const buildNames = fromBuild.children.map(n => n.value).sort();
  const buildByNames = fromBuildBy.children.map(n => n.value).sort();
  t.deepEqual(buildNames, buildByNames);
});

test('buildBy — throws for invalid argument type', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const err = t.throws(() => pt.buildBy(42));
  t.truthy(err);
  t.regex(err.message, /expected an array.*filter function/i);
});

// ─────────────────────────────────────────────
// getPathBy()
// ─────────────────────────────────────────────

test('getPathBy() — returns correct relative path for a top-level node', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  const srcNode = root.children.find(n => n.value === 'src');
  const { relative, absolute } = pt.getPathBy(srcNode);
  t.is(relative, 'src');
  t.is(absolute, resolve(tmpRoot, 'src'));
});

test('getPathBy() — returns correct nested relative path', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  const srcNode = root.children.find(n => n.value === 'src');
  const componentsNode = srcNode.children.find(n => n.value === 'components');
  const { relative, absolute } = pt.getPathBy(componentsNode);
  t.is(relative, `src${sep}components`);
  t.is(absolute, resolve(tmpRoot, 'src', 'components'));
});

test('getPathBy() — absolute path exists on disk', t => {
  const pt = new PathTreeify({ base: tmpRoot });
  const root = pt.build();
  const distNode = root.children.find(n => n.value === 'dist');
  const assetsNode = distNode.children.find(n => n.value === 'assets');
  const { absolute } = pt.getPathBy(assetsNode);
  t.true(existsSync(absolute));
});

// ─────────────────────────────────────────────
// Edge cases — empty base directory
// ─────────────────────────────────────────────

test('build() — empty base directory returns root with no children', t => {
  const emptyDir = join('/tmp', `path-treeify-empty-${Date.now()}`);
  mkdirSync(emptyDir, { recursive: true });

  try {
    const pt = new PathTreeify({ base: emptyDir });
    const root = pt.build();
    t.is(root.children.length, 0);
  } finally {
    rmSync(emptyDir, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────
// Edge cases — deeply nested single branch
// ─────────────────────────────────────────────

test('build() — deeply nested single branch has correct parent chain', t => {
  const deepRoot = join('/tmp', `path-treeify-deep-${Date.now()}`);
  mkdirSync(join(deepRoot, 'a', 'b', 'c'), { recursive: true });

  try {
    const pt = new PathTreeify({ base: deepRoot });
    const root = pt.build();

    const a = root.children.find(n => n.value === 'a');
    const b = a?.children.find(n => n.value === 'b');
    const c = b?.children.find(n => n.value === 'c');

    t.truthy(a);
    t.truthy(b);
    t.truthy(c);
    t.is(a.parent, root);
    t.is(b.parent, a);
    t.is(c.parent, b);
  } finally {
    rmSync(deepRoot, { recursive: true, force: true });
  }
});
