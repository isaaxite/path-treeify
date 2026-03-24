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

const tree2 = ptf2.build();
const path21 = tree2.children[0].children[1].getPath();
const path22 = tree2.children[0].children[1].getPath();
const path23 = tree2.getPath();

const ptf3 = new PathTreeify({
  base: join(process.cwd(), 'node_modules'),
  filter: ({ name }) => !name.startsWith('.'),
  usePathCache: true,
});
const tree3 = ptf3.build();
const path31 = tree3.children[0].children[1].getPath();
const path32 = tree3.children[0].children[1].getPath();
const path33 = tree3.getPath();

process.exit(0);
