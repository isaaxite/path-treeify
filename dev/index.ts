import { PathTreeify } from '../index';

const ptf = new PathTreeify({
  base: process.cwd(),
  fileVisible: true,
  filter: ({ name }) => name !== 'assets'
});

const tree = ptf.build();

process.exit(0);
