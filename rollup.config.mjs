import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: [
    {
      dir: 'dist/esm',
      format: 'esm',
      entryFileNames: '[name].mjs',
      sourcemap: true
    },
    {
      dir: 'dist/cjs',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      sourcemap: true
    }
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: false,
      declarationDir: undefined
    })
  ]
};
