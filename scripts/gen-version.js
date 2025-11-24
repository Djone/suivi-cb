const fs = require("fs");

const path = require("path");

const { execSync } = require("child_process");

const pkg = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8")
);

const env =
  process.env.NODE_ENV === "production" ? "production" : "development";

let displayVersion = pkg.version;

// Ajouter suffixe en dev

if (env !== "production") {
  let commit = "";

  try {
    commit = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {}

  displayVersion = `${pkg.version}-dev${commit ? "+" + commit : ""}`;
}

const outDir = path.resolve(__dirname, "../frontend/src/app");

const outFile = path.join(outDir, "version.ts");

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const content = `export const APP_VERSION = '${displayVersion}';\nexport const APP_BUILD_TIME = '${new Date().toISOString()}';\nexport const APP_ENV = '${env}';\n`;

fs.writeFileSync(outFile, content, "utf8");

console.log(
  `Generated ${path.relative(process.cwd(), outFile)} -> ${displayVersion} [${env}]`
);
