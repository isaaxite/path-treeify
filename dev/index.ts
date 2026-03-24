import { join } from 'path';
import { PathTreeify } from '../index';

const ptf = new PathTreeify({
  base: process.cwd(),
  fileVisible: true,
  filter: ({ name }) => name !== 'dev'
});

const tree = ptf.build();
const tree1 = ptf.buildBy(['node_modules']);


const ptf1 = new PathTreeify({
  base: join(process.cwd(), 'node_modules')
});

const tree11 = ptf1.build();
const tree12 = ptf1.buildBy(segment => !segment.startsWith('.'));


const ptf2 = new PathTreeify({
  base: join(process.cwd(), 'node_modules'),
  filter: ({ name }) => !name.startsWith('.'),
});

const tree21 = ptf2.build();

process.exit(0);
