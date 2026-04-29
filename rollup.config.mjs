import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/main.ts",
  output: {
    dir: "dist",
    format: "esm",
    entryFileNames: "index.js",
    sourcemap: false,
  },
  external: ["undici"],
  onwarn(warning, defaultHandler) {
    // @actions/core has an internal circular dep (core.js → oidc-utils.js → core.js)
    if (warning.code === "CIRCULAR_DEPENDENCY" && warning.message.includes("@actions/core")) return;
    defaultHandler(warning);
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      outDir: "dist",
      declaration: false,
      declarationMap: false,
      sourceMap: false,
    }),
  ],
};
