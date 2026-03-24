# Changelog

## [1.4.0](https://github.com/isaaxite/path-treeify/compare/v1.3.0...v1.4.0) (2026-03-24)


### Features

* add option to make files visible ([7836784](https://github.com/isaaxite/path-treeify/commit/7836784b93e8ab30092c4cbff823eeccf3711d66))
* **node:** add depth property to indicate tree depth ([c01b662](https://github.com/isaaxite/path-treeify/commit/c01b66294feba4db567501e8f20a0276e03584a4))
* **node:** add idx property to indicate position in parent's children array ([b749d57](https://github.com/isaaxite/path-treeify/commit/b749d575e0a196876e169fd6caf33a2b8404a70c))


### Bug Fixes

* validate and handle parameters in buildBy ([0d593cd](https://github.com/isaaxite/path-treeify/commit/0d593cd4688ad399e5db6cd85ee8189960e35f96))


### Performance Improvements

* **getPath:** use parentRelative for relative path calculation ([bbbd02c](https://github.com/isaaxite/path-treeify/commit/bbbd02cc9068c4fb3a6efd91b94335555477c233))
* share base and getPath via prototype inheritance ([1a88b75](https://github.com/isaaxite/path-treeify/commit/1a88b7518e014ce18bb2067b30c549239143e37a))


### Reverts

* **PathTreeNode:** enable absolute path resolution in node ([d133fc5](https://github.com/isaaxite/path-treeify/commit/d133fc53e47becc4b3dce5e443793448315ed95b))
* remove node idx property ([c4fea50](https://github.com/isaaxite/path-treeify/commit/c4fea50976abe3aa50734a47ed9280464a88f9f4))
* use parentRelative for relative path calculation ([1ddf4fa](https://github.com/isaaxite/path-treeify/commit/1ddf4fa7cff4fd79b9ac18973bc0e72b2e11c57f))

## [1.3.0](https://github.com/isaaxite/path-treeify/compare/v1.2.0...v1.3.0) (2026-03-22)


### Features

* **buildBy:** handle DirName with leading slash ([1d0f233](https://github.com/isaaxite/path-treeify/commit/1d0f23373a3fae9f7563ccb47adbd9bd19764521))


### Bug Fixes

* constructor filter not applied when traversing root directory ([db6fe0b](https://github.com/isaaxite/path-treeify/commit/db6fe0bcb0cf8f855ca659d402393ee00a355306))

## [1.2.0](https://github.com/isaaxite/path-treeify/compare/v1.1.0...v1.2.0) (2026-03-19)


### Features

* add buildBy dirNames or filter ([d08d633](https://github.com/isaaxite/path-treeify/commit/d08d6335a5be871176d73072d9c6be9ce745e4d0))

## [1.1.0](https://github.com/isaaxite/path-treeify/compare/v1.0.0...v1.1.0) (2026-03-19)


### Features

* add build, rename buildByDirPaths ([6dd0279](https://github.com/isaaxite/path-treeify/commit/6dd0279966f1a237d4409a9c8ee4719b9fb92604))
* **PathTreeNode:** add getPath method to retrieve current node path ([6dd96ba](https://github.com/isaaxite/path-treeify/commit/6dd96bad948578ca9dd734cae669b9c32604f87c))
