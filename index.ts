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
  idx: number;
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
   * Walks up the parent chain to compute this node's paths.
   * @returns `relative` — path from the tree root; `absolute` — fully resolved path on disk
   */
  getPath(): { relative: string; absolute: string };
}

/**
 * Shared prototype object for all nodes produced by a single {@link PathTreeify} instance.
 * Stores `base` once on the prototype rather than duplicating it across every node instance,
 * so that `getPath()` can resolve absolute paths without each node holding a redundant copy.
 */
class PathTreeNodeShared {
  base: string;

  constructor(props: { base: string }) {
    this.base = props.base;
  }

  /**
   * Walks up the parent chain to compute this node's relative path from the tree root.
   * @returns The relative path string using the platform separator
   */
  getPath() {
    let relative = '';
    let current: PathTreeNode = this as any;
    while (current.parent) {
      relative = relative
        ? `${current.value}${sep}${relative}`
        : current.value;
      current = current.parent;
    }
    return { relative, absolute: resolve(this.base, relative) };
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

  constructor({ filter, base, fileVisible }: Partial<PathTreeifyProps>) {
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
    this.pathTreeNodeShared = new PathTreeNodeShared({ base });
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
   * The node's prototype is set to {@link pathTreeNodeShared} so that `base` and
   * `getPath` are inherited without being stored on each instance individually.
   */
  private initNode(): PathTreeNode {
    const node: PathTreeNode = Object.create(this.pathTreeNodeShared);
    node.parent = null;
    node.value = '';
    node.children = [];
    node.type = PathTreeNodeKind.Unknown;
    node.idx = -1;
    node.depth = -1;
    return node;
  }

  /**
   * Recursively reads {@link dirPath} and builds child nodes for each entry that
   * passes {@link applyFilter}. Directories are traversed depth-first;
   * files (when {@link fileVisible} is true) become leaf nodes.
   * @param dirPath - Absolute path of the directory to read
   * @param parent - The parent node to attach child nodes to
   */
  private buildChildren(dirPath: string, parent: PathTreeNode, segments?: string[]): PathTreeNode[] {
    const children: PathTreeNode[] = [];
    const names = segments || readdirSync(dirPath);

    let idx = 0;
    for (const name of names) {
      const subPath = join(dirPath, name);

      if (!this.applyFilter(subPath, name)) {
        continue;
      }

      const node = this.initNode();
      node.idx = idx++;
      node.depth = parent.depth + 1;
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
   * @param relativeSegments - Relative path strings to validate
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
   * Builds a subtree containing only the entries identified by {@link segments}.
   * Paths are normalised via {@link formatSegments} and validated before use.
   * @param segments - Relative paths to include as top-depth nodes
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
