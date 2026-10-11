// Bun's `with { type: "file" }` imports resolve to a path string.
declare module "*.png" {
  const path: string;
  export default path;
}
