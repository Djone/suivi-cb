const fs = require("fs");
const path = require("path");
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8")
);
const outDir = path.resolve(__dirname, "../frontend/src/app");
const outFile = path.join(outDir, "version.ts");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const content = `export const APP_VERSION = '${pkg.version}';\nexport const APP_BUILD_TIME = '${new Date().toISOString()}';\n`;

fs.writeFileSync(outFile, content, "utf8");

console.log(
  `Generated ${path.relative(process.cwd(), outFile)} with version ${pkg.version}`
);
