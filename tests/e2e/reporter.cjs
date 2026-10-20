const fs = require("node:fs");
const { redact } = require("./safety.cjs");
module.exports = class SafeReporter {
  onError(error) {
    console.log(
      redact(error.message || "PLAYWRIGHT_ERROR", [
        process.env.E2E_PASSWORD,
        process.env.E2E_ADMIN_PASSWORD,
      ]),
    );
  }
  constructor() {
    this.results = [];
  }
  onTestEnd(test, result) {
    const item = {
      name: test.titlePath().slice(1).join(" > "),
      status: result.status,
      durationMs: result.duration,
    };
    if (result.status !== "passed")
      for (const e of result.errors || [])
        console.log(
          redact(e.message || "", [
            process.env.E2E_PASSWORD,
            process.env.E2E_ADMIN_PASSWORD,
          ]),
        );
    this.results.push(item);
    console.log(item.status.toUpperCase() + ": " + item.name);
  }
  onEnd(result) {
    fs.writeFileSync(
      process.env.E2E_OUTPUT + "/tests.json",
      JSON.stringify({ status: result.status, tests: this.results }, null, 2),
    );
  }
};
