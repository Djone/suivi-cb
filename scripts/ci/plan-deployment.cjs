// Install only in the private deployment-control repository, never on a public PR runner.
const fs = require("node:fs"),
  path = require("node:path");
const { deploymentPlan } = require("./contracts.cjs");
const [file, target] = process.argv.slice(2);
if (!file || !["preproduction", "production"].includes(target))
  throw Error("Usage: node scripts/ci/plan-deployment.cjs MANIFEST TARGET");
const m = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
console.log(JSON.stringify(deploymentPlan(m, target), null, 2));
