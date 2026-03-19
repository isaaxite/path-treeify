import { accessSync, constants, statSync, readdirSync } from 'fs';
import { join, sep, resolve } from 'path';

/** A filter function that determines whether a directory should be included in the tree */
type FilterFunction = (params: { name: string; dirPath: string }) => boolean;

/** Constructor options for PathTreeify */
interface PathTreeifyProps {
  base: string;
  filter?: FilterFunction;
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
}

/** Represents a single node (directory) in the path tree */
class PathTreeNode {
  /** The root base path used to resolve absolute paths */
  private base: string;
  /** Reference to the parent node; null for the root node */
  public parent: PathTreeNode | null = null;
  /** The directory name of this node (not a full path) */
  public value: string = '';
  /** Child nodes representing subdirectories */
  public children: PathTreeNode[] = [];

  constructor(base: string) {
    this.base = base;
  }

  /**
   * Walks up the parent chain to compute this node's relative and absolute paths.
   * @returns An object containing the relative path from base and the absolute path
   */
  getPath(): { relative: string; absolute: string } {
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

/** Builds a tree of directory nodes rooted at a given base path */
export class PathTreeify {
  /** The root directory to scan */
  private base: string;
  /** Optional filter applied to each directory during traversal */
  private filter?: FilterFunction;

  constructor({ filter, base }: Partial<PathTreeifyProps>) {
    if (typeof filter !== 'undefined') {
      this.validateFilter(filter);
      this.filter = filter;
    }

    if(!base || !PathValidator.isValid(base)) {
      throw new Error(`${base} is not a valid path!`);
    }

    if (!PathValidator.isDirectory(base)) {
      throw new Error(`${base} is not a dirPath!`);
    }

    this.base = base;
  }

  /**
   * Validates that the provided filter is a function, accepts one parameter,
   * and returns a boolean. Throws a TypeError if any condition is violated.
   */
  private validateFilter(filter: any): asserts filter is FilterFunction {
    if (typeof filter !== 'function') {
      throw new TypeError('filter must be a function');
    }
  
    if (filter.length !== 1) {
      throw new TypeError('filter must accept exactly one parameter');
    }
    
    try {
      const testResult = filter({ name: 'test', postPath: '/test' });
      if (typeof testResult !== 'boolean') {
        throw new TypeError('filter must return a boolean');
      }
    } catch (error) {
      throw new TypeError('filter function threw an error during test: ' + error);
    }
  }

  /**
   * Creates and optionally attaches a new PathTreeNode to a parent.
   * @param parent - The parent node to attach to, or null for the root
   */
  private initNode(parent: PathTreeNode | null = null): PathTreeNode {
    const node = new PathTreeNode(this.base);
    if (parent) {
      node.parent = parent;
    }
    return node;
  }

  /**
   * Recursively reads a directory and builds child nodes for each subdirectory.
   * Applies the instance-level filter if one is set.
   * @param dirPath - Absolute path of the directory to read
   * @param parent - The parent node to attach children to
   */
  private buildChildren(dirPath: string, parent: PathTreeNode) {
    const names = readdirSync(dirPath);
    const children: Array<PathTreeNode> = [];
    for (const name of names) {
      const subPath = join(dirPath, name);
      if (!statSync(subPath).isDirectory()) {
        continue;
      }

      if (this.filter && !this.filter({ dirPath, name })) {
        continue;
      }

      const node = this.initNode();
      node.value = name;
      node.parent = parent;
      node.children = this.buildChildren(subPath, node);
      children.push(node);
    }

    return children;
  }

  /**
   * Validates that each entry in the array is a string pointing to
   * an accessible directory relative to the base path.
   * @param relativeDirNames - Array of relative directory path strings to validate
   */
  private checkRelativePaths(relativeDirNames: string[]) {
    if (!Array.isArray(relativeDirNames)) {
      throw new Error(`Expected array, got ${typeof relativeDirNames}`);
    }

    for (let i = 0; i < relativeDirNames.length; i++) {
      const it = relativeDirNames[i];
      
      if (typeof it !== 'string') {
        throw new Error(`Item at index ${i} is not a string, got ${typeof it}`);
      }

      const absPath = resolve(this.base, it);
      if (!PathValidator.isValid(absPath)) {
        throw new Error(`Path does not exist or is not accessible: ${absPath} (from relative path: ${it})`);
      }
      
      if (!PathValidator.isDirectory(absPath)) {
        throw new Error(`Path is not a directory: ${absPath} (from relative path: ${it})`);
      }
    }
  }

  /**
   * Strips leading and trailing slashes from each directory name
   * and removes any resulting empty strings.
   */
  private formatDirnames(dirNames: string[]): string[] {
    return dirNames.map(dir => {
      // Remove leading and trailing slashes
      return dir.replace(/^\/+|\/+$/g, '');
    }).filter(dir => dir !== ''); // Optional: filter empty strings
  }

  /** Returns the names of all immediate subdirectories under the base path */
  private getAllDirNamesUnderBase() {
    return readdirSync(this.base).filter(name => {
      const abs = resolve(this.base, name);
      return PathValidator.isDirectory(abs);
    });
  }

  /**
   * Builds a tree rooted at base, containing only the specified subdirectories.
   * @param dirNames - Relative directory names to include as top-level nodes
   */
  private buildByDirNames(dirNames: string[]) {
    const root = this.initNode();
    this.checkRelativePaths(dirNames);
    const dirNameArr = this.formatDirnames(dirNames);

    for (const dirName of dirNameArr) {
      const node = this.initNode();
      node.value = dirName;
      node.parent = root;
      node.children = this.buildChildren(resolve(this.base, dirName), node);
      root.children.push(node);
    }

    return root;
  }

  /**
   * Builds a tree using only the subdirectories under base that pass the given filter.
   * @param filter - A predicate applied to each top-level directory name
   */
  private buildByFilter(filter: (dirName: string) => boolean): PathTreeNode {
    const allDirNames = this.getAllDirNamesUnderBase();
    return this.buildByDirNames(allDirNames.filter(filter));
  }

  /**
   * Computes the relative and absolute paths for a given node
   * by walking up the parent chain.
   */
  getPathBy(node: PathTreeNode): { relative: string; absolute: string } {
    let relative = '';
    let current = node;
    while (current.parent) {
      relative = relative
        ? `${current.value}${sep}${relative}`
        : current.value;
      current = current.parent;
    }
    
    return { relative, absolute: resolve(this.base, relative) };
  }

  /** Overload: build the tree from an explicit list of relative directory names */
  buildBy(dirNames: string[]): PathTreeNode;
  /** Overload: build the tree from a predicate applied to top-level directory names */
  buildBy(filter: (dirName: string) => boolean): PathTreeNode;
  /**
   * Builds a subtree based on either an array of directory names or a filter function.
   * Throws if the argument is neither.
   */
  buildBy(argv: any): PathTreeNode {
    if (Array.isArray(argv)) {
      return this.buildByDirNames(argv);
    }

    if (typeof argv === 'function') {
      return this.buildByFilter(argv);
    }

    throw new TypeError(
      `buildBy: expected an array of strings or a filter function, but received ${typeof argv}`
    );
  }

  /** Builds a full tree from all immediate subdirectories under the base path */
  build() {
    const dirNameArr = this.getAllDirNamesUnderBase();
    return this.buildByDirNames(dirNameArr);
  }
}
