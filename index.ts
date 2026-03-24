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

export interface PathTreeNode {
  parent: PathTreeNode | null;
  value: string;
  children: PathTreeNode[];
  type: PathTreeNodeKind;
  getPath(): { relative: string; absolute: string };
}

/** Represents a single entry (directory or file) in the path tree */
class PathTreeNodeImpl implements PathTreeNode {
  private base: string;
  /** Reference to the parent node; null for the root node */
  public parent: PathTreeNode | null = null;
  /** The entry name of this node (not a full path) */
  public value: string = '';
  /** Child nodes; non-empty only for directory nodes */
  public children: PathTreeNode[] = [];
  /** Whether this node is a directory, a file, or not yet resolved */
  public type: PathTreeNodeKind = PathTreeNodeKind.Unknown;

  constructor(base: string) {
    this.base = base;
  }

  /**
   * Walks up the parent chain to compute this node's relative path from the tree root.
   * @returns The relative path string using the platform separator
   */
  getPath() {
    let relative = '';
    let current: PathTreeNode = this;
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
   * Optional user-supplied filter. When set, every entry must pass this predicate
   * in addition to the built-in visibility check.
   */
  private userFilter?: FilterFunction;
  /** When true, files are included as leaf nodes during traversal. Defaults to false */
  private fileVisible = false;

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

  /** Creates a new unattached {@link PathTreeNode} */
  private initNode(): PathTreeNode {
    return new PathTreeNodeImpl(this.base);
  }

  /**
   * Recursively reads {@link dirPath} and builds child nodes for each entry that
   * passes {@link applyFilter}. Directories are traversed depth-first;
   * files (when {@link fileVisible} is true) become leaf nodes.
   * @param dirPath - Absolute path of the directory to read
   * @param parent - The parent node to attach child nodes to
   */
  private buildChildren(dirPath: string, parent: PathTreeNode): PathTreeNode[] {
    const children: PathTreeNode[] = [];
    const names = readdirSync(dirPath);

    for (const name of names) {
      const subPath = join(dirPath, name);

      if (!this.applyFilter(subPath, name)) {
        continue;
      }

      const node = this.initNode();
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
    if (!Array.isArray(relativeSegments)) {
      throw new Error(`Expected array, got ${typeof relativeSegments}`);
    }

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
   * @param segments - Relative paths to include as top-level nodes
   */
  private buildBySegments(segments: string[]): PathTreeNode {
    const root = this.initNode();
    const segmentArr = this.formatSegments(segments);
    this.checkRelativePaths(segmentArr);

    for (const segment of segmentArr) {
      const absPath = resolve(this.base, segment);
      const node = this.initNode();

      node.value = segment;
      node.parent = root;
      root.children.push(node);

      if (this.fileVisible && PathValidator.isFile(absPath)) {
        node.type = PathTreeNodeKind.File;
      } else {
        node.type = PathTreeNodeKind.Dir;
        node.children = this.buildChildren(absPath, node);
      }
    }

    return root;
  }

  /**
   * Builds a subtree from top-level entries whose names satisfy {@link filter}.
   * Note: this predicate only affects top-level selection, not recursive traversal.
   * For recursive filtering use the `filter` constructor option.
   * @param filter - Predicate applied to each top-level entry name
   */
  private buildByFilter(filter: (segment: string) => boolean): PathTreeNode {
    const segments = this.getAllEntriesUnderBase();
    return this.buildBySegments(segments.filter(filter));
  }

  /** Overload: build the tree from an explicit list of relative path segments */
  buildBy(segments: string[]): PathTreeNode;
  /** Overload: build the tree from a predicate applied to top-level entry names */
  buildBy(filter: (segment: string) => boolean): PathTreeNode;
  /**
   * Builds a subtree from either an array of path segments or a filter function.
   * @throws {TypeError} If the argument is neither an array nor a function
   */
  buildBy(argv: any): PathTreeNode {
    if (Array.isArray(argv)) {
      return this.buildBySegments(argv);
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
