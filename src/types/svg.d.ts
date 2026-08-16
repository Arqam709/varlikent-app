/**
 * TYPE DECLARATION FOR .svg IMPORTS
 *
 * Metro now knows how to turn an .svg file into a React component, but that
 * happens at BUILD time and TypeScript knows nothing about it. Without this
 * file, `import Icon from './logo.svg'` fails to compile with
 * "Cannot find module ... or its corresponding type declarations".
 *
 * This tells the type system: any module path ending in `.svg` has a default
 * export that is a React component accepting react-native-svg's props
 * (`width`, `height`, `fill`, `color`, ...).
 *
 * It is a pure type declaration — it emits no JavaScript and has no effect at
 * runtime. It only teaches the compiler about what Metro already does.
 *
 * Web equivalent: the `vite-env.d.ts` reference that makes `*.svg?react`
 * imports typecheck in a Vite project.
 */
declare module '*.svg' {
  import type React from 'react';
  import type { SvgProps } from 'react-native-svg';

  const content: React.FC<SvgProps>;
  export default content;
}
