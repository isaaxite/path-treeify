import { accessSync, statSync, constants, lstatSync } from "fs";
import { PathTreeNode, PathTreeNodeKind } from "./types";
import { resolve, sep } from "path";

/** Defines read-only properties on an object. Each property is set to the corresponding value in the props object, and is non-writable, non-configurable, and non-enumerable.
 * @param obj - The target object on which to define the properties
 * @param props - An object where keys are property names and values are the corresponding property values to set
 */
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

/** Determines the type of a given path, classifying it as a directory, file, symbolic link, or other. If the path does not exist, it is classified as NotFound. If any unexpected error occurs during the stat/lstat operations, it will be thrown to the caller.
 * @param p - The path to classify
 * @returns A PathTreeNodeKind value indicating the type of the path
 */
export function getPathType(p: string): PathTreeNodeKind {
  try {
    const stat = statSync(p);
    if (stat.isDirectory()) {
      try {
        accessSync(p, constants.X_OK);
      } catch {
        return PathTreeNodeKind.PermissionDenied;
      }
      return PathTreeNodeKind.Dir;
    }
    if (stat.isFile()) return PathTreeNodeKind.File;
    return PathTreeNodeKind.Other;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'EACCES') return PathTreeNodeKind.PermissionDenied;
    if (code !== 'ENOENT') throw e;
  }

  try {
    const lstat = lstatSync(p);
    if (lstat.isSymbolicLink()) return PathTreeNodeKind.BrokenSymlink;
    return PathTreeNodeKind.Other;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'EACCES') return PathTreeNodeKind.PermissionDenied;
    if (code !== 'ENOENT') throw e;
  }

  return PathTreeNodeKind.NotFound;
}

/** A safer wrapper around getPathType that catches any unexpected errors and returns PathTreeNodeKind.Error instead. This is useful for scenarios where we want to classify inaccessible paths without crashing the entire process. */
export function getSafePathType(p: string): PathTreeNodeKind {
  try {
    return getPathType(p);
  } catch (e) {
    return PathTreeNodeKind.Error;  
  }
}
/** Implementation of the PathTreeNode interface. This class is not exported; consumers receive nodes through the PathTreeify API as the PathTreeNode interface type. */
export class PathTreeNodeImp implements PathTreeNode {
  depth: number = -1;
  parent: PathTreeNode | null = null;
  value: string = '';
  children: PathTreeNode[] = [];
  type: PathTreeNodeKind = PathTreeNodeKind.Unknown;

  constructor(props: { usePathCache: boolean }) {
    defineReadOnlyProps(this, {
      _usePathCache: props.usePathCache,
    });
  }

  /** Retrieves the absolute and relative path represented by this node. If path caching is enabled, the result will be cached after the first retrieval to optimize subsequent calls. */
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
