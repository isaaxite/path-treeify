/** A filter function that determines whether an entry should be included in the tree */
export type FilterFunction = (params: { name: string; dirPath: string }) => boolean;

/** Constructor options for PathTreeify */
export interface PathTreeifyProps {
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
