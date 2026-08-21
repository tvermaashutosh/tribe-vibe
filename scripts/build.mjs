import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/ui/index.jsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/ui.js',
  external: ['react', 'ink', 'ink-select-input', 'ink-text-input'],
  jsx: 'automatic',
  jsxImportSource: 'react',
  // exceljs (via uuid) is CJS and calls require("crypto")/require("stream")/etc.
  // deep inside its own module bodies — esbuild preserves these as runtime
  // require() calls (it can't hoist a nested require into a static ESM import
  // without changing evaluation order), and ESM has no ambient `require`.
  // This banner gives the bundle a real one via Node's createRequire, so those
  // calls resolve exactly like they would in a normal CJS module.
  banner: {
    js: "import { createRequire as __tribeVibeCreateRequire } from 'node:module';\nconst require = __tribeVibeCreateRequire(import.meta.url);",
  },
});

console.log('Built dist/ui.js');
