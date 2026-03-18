import { accessSync, constants, statSync, readdirSync } from 'fs';
import { join, sep, resolve } from 'path';

type FilterFunction = (params: { name: string; dirPath: string }) => boolean;
interface PathTreeifyProps {
  base: string;
  filter?: FilterFunction;
}

interface PathTreeNode {
  parent: PathTreeNode | null;
  value: string;
  children: PathTreeNode[];
}

class PathValidator {
  static isValid(path: string): boolean {
    try {
      accessSync(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
  
  static isDirectory(path: string): boolean {
    try {
      return statSync(path).isDirectory();
    } catch {
      return false;
    }
  }
}

export class PathTreeify {
  private base: string;
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

  private initNode(parent: PathTreeNode | null = null): PathTreeNode {
    return { parent, value: '', children: [] };
  }

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

  private checkRelatePaths(relativeDirNames: string[]) {
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

  private formatDirnames(nameOfDirs: string[]): string[] {
    return nameOfDirs.map(dir => {
      // 移除开头的 / 和结尾的 /
      return dir.replace(/^\/+|\/+$/g, '');
    }).filter(dir => dir !== ''); // 可选：过滤掉空字符串
  }

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

  buildByDirPaths(nameOfDirs: string[]) {
    const root = this.initNode();
    this.checkRelatePaths(nameOfDirs);
    const dirNames = this.formatDirnames(nameOfDirs);

    for (const dirName of dirNames) {
      const node = this.initNode();
      node.value = dirName;
      node.parent = root;
      node.children = this.buildChildren(resolve(this.base, dirName), node);
      root.children.push(node);
    }

    return root;
  }
}
