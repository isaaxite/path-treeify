import { accessSync, constants, statSync, readdirSync } from 'fs';
import { join, sep, resolve, dirname } from 'path';

/** A filter function that determines whether an entry should be included in the tree */
type FilterFunction = (params: { name: string; dirPath: string }) => boolean;

/** Constructor options for PathTreeify */
interface PathTreeifyProps {
  /** The root directory to scan */
  base: string;
  /** Optional filter applied to every entry during recursive traversal */
  filter?: FilterFunction;
  /** When true, files are included as leaf nodes alongside directories. Defaults to false */
  fileVisible?: boolean;

  /**
   * When true, the result of {@link PathTreeNode.getPath} is memoised on each node
   * after the first call. Subsequent calls return the same object reference without
   * re-walking the parent chain. Useful when nodes are accessed repeatedly.
   * Defaults to false.
   */
  usePathCache?: boolean;
}

/** Utility class for validating file system paths */
class PathValidator {
  /** Returns true if the path exists and is accessible */
  static isValid(path: string): boolean {
    try {
      accessSync(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /** Returns true if the path points to a directory */
  static isDirectory(path: string): boolean {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  }

  /** Returns true if the path points to a regular file */
  static isFile(path: string): boolean {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  }
}

/** Classification of a node in the path tree */
export enum PathTreeNodeKind {
  Dir = 'dir',
  File = 'file',
  /** Assigned before the node's type has been resolved */
  Unknown = 'unknown',
}

/**
 * Public interface for a node in the path tree.
 * Consumers receive this type; the internal implementation class is not exported.
 */
export interface PathTreeNode {
  /** Distance from the root node; root itself is 0, its direct children are 1, and so on */
  depth: number;
  /** Reference to the parent node; null for the root node */
  parent: PathTreeNode | null;
  /** The entry name of this node (not a full path) */
  value: string;
  /** Child nodes; non-empty only for directory nodes */
  children: PathTreeNode[];
  /** Whether this node is a directory, a file, or not yet resolved */
  type: PathTreeNodeKind;
  /**
   * Walks up the parent chain to compute this node's relative and absolute paths.
   * When the owning {@link PathTreeify} instance was created with `usePathCache: true`,
   * the result is memoised after the first call and the same object is returned on
   * every subsequent call.
   * @returns `relative` — path from the tree root; `absolute` — fully resolved path on disk
   */
  getPath(): { relative: string; absolute: string };
}

/**
 * Shared prototype object for all nodes produced by a single {@link PathTreeify} instance.
 * Stores `base` and `usePathCache` once on the prototype rather than duplicating them
 * across every node instance, so that `getPath()` can resolve absolute paths without
 * each node holding a redundant copy.
 */
class PathTreeNodeShared {
  private base: string;
  private usePathCache: boolean = false;

  constructor(props: { base: string, usePathCache?: boolean }) {
    this.base = props.base;
    if (typeof props.usePathCache === 'boolean') {
      this.usePathCache = props.usePathCache;
    }
  }

  /**
   * Walks up the parent chain to compute this node's relative and absolute paths.
   *
   * When `usePathCache` is `false` (default), the parent chain is walked on every call
   * and a new result object is returned each time.
   *
   * When `usePathCache` is `true`, the result is computed once and stored as `_pathCache`
   * directly on the node instance. Subsequent calls return the cached object, making
   * repeated access O(1) after the first call.
   *
   * @returns `relative` — sep-joined path from the tree root to this node;
   *          `absolute` — fully resolved path on disk
   */
  getPath() {
    let self = this as any;
    const getPathForce = () => {
      let relative = '';
      let current: PathTreeNode = this as any;
      while (current.parent) {
        relative = relative ? `${current.value}${sep}${relative}` : current.value;
        current = current.parent;
      }
      return { relative, absolute: resolve(self.base, relative) };
    };

    if (!self.usePathCache) {
      return getPathForce();
    }

    if (!self._pathCache) {
      self._pathCache = getPathForce();
    }
    return self._pathCache;
  }
}

/** Builds a tree of {@link PathTreeNode} entries rooted at a given base path */
export class PathTreeify {
  /** The root directory to scan */
  private base: string;
  /**
   * Shared prototype instance for nodes produced by this builder.
   * All nodes created via {@link initNode} inherit `base` and `getPath` from this object,
   * avoiding per-node storage of the base path string.
   */
  private pathTreeNodeShared: PathTreeNodeShared;
  /**
   * Optional user-supplied filter. When set, every entry must pass this predicate
   * in addition to the built-in visibility check.
   */
  private userFilter?: FilterFunction;
  /** When true, files are included as leaf nodes during traversal. Defaults to false */
  private fileVisible = false;

  constructor(props: Partial<PathTreeifyProps>) {
    const { filter, base, fileVisible, usePathCache } = props;

    if (typeof fileVisible === 'boolean' && fileVisible) {
      this.fileVisible = fileVisible;
    }

    if (typeof filter !== 'undefined') {
      this.validateFilter(filter);
      this.userFilter = filter;
    }

    if (!base || !PathValidator.isValid(base)) {
      throw new Error(`${base} is not a valid path!`);
    }

    if (!PathValidator.isDirectory(base)) {
      throw new Error(`${base} is not a dirPath!`);
    }

    this.base = base;
    this.pathTreeNodeShared = new PathTreeNodeShared({ base, usePathCache });
  }

  /**
   * Determines whether a given entry should be included in the tree.
   * - If {@link fileVisible} is false, non-directory entries are always excluded.
   * - If a {@link userFilter} is set, the entry must also satisfy it.
   * @param absPath - Absolute path of the entry to test
   * @param name - Entry name (filename or directory name)
   */
  private applyFilter(absPath: string, name: string): boolean {
    if (!this.fileVisible && !PathValidator.isDirectory(absPath)) {
      return false;
    }
    return this.userFilter
      ? this.userFilter({ name, dirPath: dirname(absPath) })
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
    const cache = Object.create(this.pathTreeNodeShared);
    const node = Object.create(cache);
    node.parent = null;
    node.value = '';
    node.children = [];
    node.type = PathTreeNodeKind.Unknown;
    node.depth = -1;
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
    const names = segments || readdirSync(dirPath);
    const depth = parent.depth + 1;

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

      if (this.fileVisible && PathValidator.isFile(subPath)) {
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

      const absPath = resolve(this.base, it);

      if (!PathValidator.isValid(absPath)) {
        throw new Error(`Path does not exist or is not accessible: ${absPath} (from relative path: ${it})`);
      }

      if (!PathValidator.isDirectory(absPath)) {
        if (!this.fileVisible || !PathValidator.isFile(absPath)) {
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
    return readdirSync(this.base).filter(name => {
      const abs = resolve(this.base, name);
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
    root.children = this.buildChildren(this.base, root, segments);
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
