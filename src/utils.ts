import { accessSync, statSync, constants } from "fs";
import { PathTreeNode, PathTreeNodeKind } from "./types";
import { resolve, sep } from "path";

export function defineReadOnlyProps(obj: any, props: { [key: string]: any }) {
  for (const key in props) {
    Object.defineProperty(obj, key, {
      value: props[key],
      writable: false,
      configurable: false,
      enumerable: false,
    });
  }
};

/** Utility class for validating file system paths */
export class PathValidator {
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

export class PathTreeNodeImp implements PathTreeNode {
  depth: number = -1;
  parent: PathTreeNode | null = null;
  value: string = '';
  children: PathTreeNode[] = [];
  type: PathTreeNodeKind = PathTreeNodeKind.Unknown;

  constructor(props: any) {
    defineReadOnlyProps(this, {
      _usePathCache: props.usePathCache,
    });
  }

  getPath(): { relative: string; absolute: string } {
    let self = this as any;
    let base = '';
    const getPathForce = () => {
      let relative = '';
      let current: PathTreeNode = this as any;
      while (true) {
        if (current.parent === null) {
          base = current.value;
          break;
        }

        relative = relative ? `${current.value}${sep}${relative}` : current.value;
        current = current.parent;
      }
      return { relative, absolute: resolve(base, relative) };
    };

    if (!self._usePathCache) {
      return getPathForce();
    }

    if (!self._pathCache) {
      defineReadOnlyProps(this, {
        _pathCache: getPathForce(),
      });
    }
    return self._pathCache;
  }
}
