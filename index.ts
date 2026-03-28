import { readdirSync } from 'fs';
import { join, sep, resolve, dirname } from 'path';
import { defineReadOnlyProps, PathTreeNodeImp, PathValidator } from './src/utils';
import { FilterFunction, PathTreeifyProps, PathTreeNode, PathTreeNodeKind } from './src/types';

export { PathTreeifyProps, PathTreeNodeKind, PathTreeNode } from './src/types';

/** Builds a tree of {@link PathTreeNode} entries rooted at a given base path */
export class PathTreeify {
  /** The root directory to scan */
  private _base: string = '';
  /** When true, files are included as leaf nodes during traversal. Defaults to false */
  private _fileVisible = false;

  private _usePathCache: boolean = false;

  /**
   * Optional user-supplied filter. When set, every entry must pass this predicate
   * in addition to the built-in visibility check.
   */
  private _userFilter?: FilterFunction;

  constructor(props: Partial<PathTreeifyProps>) {
    const { filter, base, fileVisible, usePathCache } = props;

    if (typeof filter !== 'undefined') {
      this.validateFilter(filter);
      defineReadOnlyProps(this, {
        _userFilter: filter,
      });
    }

    if (!base || !PathValidator.isValid(base)) {
      throw new Error(`${base} is not a valid path!`);
    }

    if (!PathValidator.isDirectory(base)) {
      throw new Error(`${base} is not a dirPath!`);
    }

    defineReadOnlyProps(this, {
      _usePathCache: Boolean(usePathCache),
      _base: base,
      _fileVisible: typeof fileVisible === 'boolean' && fileVisible ? fileVisible : false,
    });
  }

  /**
   * Determines whether a given entry should be included in the tree.
   * - If {@link fileVisible} is false, non-directory entries are always excluded.
   * - If a {@link userFilter} is set, the entry must also satisfy it.
   * @param absPath - Absolute path of the entry to test
   * @param name - Entry name (filename or directory name)
   */
  private applyFilter(absPath: string, name: string): boolean {
    if (!this._fileVisible && !PathValidator.isDirectory(absPath)) {
      return false;
    }
    return this._userFilter
      ? this._userFilter({ name, dirPath: dirname(absPath) })
      : true;
  }

  /**
   * Asserts that the provided value is a callable {@link FilterFunction}.
   * Throws a TypeError if the check fails.
   */
  private validateFilter(filter: any): asserts filter is FilterFunction {
    if (typeof filter !== 'function') {
      throw new TypeError('filter must be a function');
    }
  }

  /**
   * Creates a new unattached {@link PathTreeNode}.
   * The node is created with a two-layer prototype chain:
   * `node → cache → pathTreeNodeShared`. The intermediate `cache` layer is a
   * per-node object that holds `_pathCache` when `usePathCache` is enabled,
   * keeping the cached value isolated to each node while still inheriting `base`
   * and `getPath` from `pathTreeNodeShared`.
   * `depth` is initialised to `-1` and must be set by the caller.
   */
  private initNode(): PathTreeNode {
    const node = new PathTreeNodeImp({
      usePathCache: this._usePathCache,
    });
    return node;
  }

  /**
   * Recursively reads {@link dirPath} and builds child nodes for each entry that
   * passes {@link applyFilter}. Directories are traversed depth-first;
   * files (when {@link fileVisible} is true) become leaf nodes.
   *
   * @param dirPath  - Absolute path of the directory to read
   * @param parent   - The parent node to attach child nodes to
   * @param segments - Optional explicit list of entry names to use instead of reading the
   *                   directory from disk; used by {@link buildBySegments} to skip a
   *                   redundant `readdirSync` when the segment list is already known
   */
  private buildChildren(dirPath: string, parent: PathTreeNode, segments?: string[]): PathTreeNode[] {
    const children: PathTreeNode[] = [];
    const depth = parent.depth + 1;
    let names = segments;

    try {
      names = readdirSync(dirPath);
    } catch (error) {
      return children;
    }

    for (const name of names) {
      const subPath = join(dirPath, name);

      if (!this.applyFilter(subPath, name)) {
        continue;
      }

      const node = this.initNode();
      node.depth = depth;
      node.value = name;
      node.parent = parent;
      children.push(node);

      if (this._fileVisible && PathValidator.isFile(subPath)) {
        node.type = PathTreeNodeKind.File;
        continue;
      }

      node.type = PathTreeNodeKind.Dir;
      node.children = this.buildChildren(subPath, node);
    }

    return children;
  }

  /**
   * Validates that every entry in {@link relativeSegments} refers to an accessible
   * path under {@link base}. When {@link fileVisible} is false, each path must be
   * a directory; when true, regular files are also accepted.
   * @param relativeSegments - Relative path strings to validate; assumed to be a string
   *                           array (callers are responsible for type safety at the boundary)
   */
  private checkRelativePaths(relativeSegments: string[]): void {
    for (let i = 0; i < relativeSegments.length; i++) {
      const it = relativeSegments[i];

      if (typeof it !== 'string') {
        throw new Error(`Item at index ${i} is not a string, got ${typeof it}`);
      }

      const absPath = resolve(this._base, it);

      if (!PathValidator.isValid(absPath)) {
        throw new Error(`Path does not exist or is not accessible: ${absPath} (from relative path: ${it})`);
      }

      if (!PathValidator.isDirectory(absPath)) {
        if (!this._fileVisible || !PathValidator.isFile(absPath)) {
          throw new Error(`Path is not a directory: ${absPath} (from relative path: ${it})`);
        }
      }
    }
  }

  /**
   * Normalises an array of path strings by splitting on both slash styles,
   * dropping empty segments, and rejoining with the platform separator.
   * Entries that reduce to an empty string (e.g. `"///"`) are removed.
   * @param segments - Raw path strings to normalise
   */
  private formatSegments(segments: string[]): string[] {
    return segments
      .map(segment => segment.split(/[/\\]/).filter(Boolean).join(sep))
      .filter(Boolean);
  }

  /**
   * Returns the names of all immediate entries under {@link base} that pass
   * {@link applyFilter}.
   */
  private getAllEntriesUnderBase(): string[] {
    return readdirSync(this._base).filter(name => {
      const abs = resolve(this._base, name);
      return this.applyFilter(abs, name);
    });
  }

  /**
   * Builds a subtree whose top-depth children correspond to {@link segments}.
   * The root node is created at depth 0; children are built by delegating to
   * {@link buildChildren}, passing {@link segments} directly to avoid a redundant
   * `readdirSync` of the base directory.
   * @param segments - Normalised and validated relative path segments
   */
  private buildBySegments(segments: string[]): PathTreeNode {
    const root = this.initNode();
    root.depth = 0;
    root.value = this._base;
    root.type = PathTreeNodeKind.Dir;
    root.children = this.buildChildren(this._base, root, segments);
    return root;
  }

  /**
   * Builds a subtree from top-depth entries whose names satisfy {@link filter}.
   * Note: this predicate only affects top-depth selection, not recursive traversal.
   * For recursive filtering use the `filter` constructor option.
   * @param filter - Predicate applied to each top-depth entry name
   */
  private buildByFilter(filter: (segment: string) => boolean): PathTreeNode {
    const segments = this.getAllEntriesUnderBase();
    return this.buildBySegments(segments.filter(filter));
  }

  /** Overload: build the tree from an explicit list of relative path segments */
  buildBy(segments: string[]): PathTreeNode;
  /** Overload: build the tree from a predicate applied to top-depth entry names */
  buildBy(filter: (segment: string) => boolean): PathTreeNode;
  /**
   * Builds a subtree from either an array of path segments or a filter function.
   * When an array is supplied, segments are normalised via {@link formatSegments}
   * and validated via {@link checkRelativePaths} before the tree is built.
   * @throws {TypeError} If the argument is neither an array nor a function
   */
  buildBy(argv: any): PathTreeNode {
    if (Array.isArray(argv)) {
      const segments = this.formatSegments(argv);
      this.checkRelativePaths(segments);
      return this.buildBySegments(segments);
    }

    if (typeof argv === 'function') {
      return this.buildByFilter(argv);
    }

    throw new TypeError(
      `buildBy: expected an array of strings or a filter function, but received ${typeof argv}`
    );
  }

  /** Builds a full tree from all immediate entries under the base path */
  build(): PathTreeNode {
    const segments = this.getAllEntriesUnderBase();
    return this.buildBySegments(segments);
  }
}
