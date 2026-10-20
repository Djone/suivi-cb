// Run inside an already installed backend image; never restores or replaces the source.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
async function snapshot(source, destination, sqlite) {
  if (fs.existsSync(destination)) throw Error("SNAPSHOT_ALREADY_EXISTS");
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 });
  const open = (file) =>
    new Promise((resolve, reject) => {
      const db = new sqlite.Database(file, sqlite.OPEN_READONLY, (e) =>
        e ? reject(e) : resolve(db),
      );
    });
  const close = (db) =>
    new Promise((resolve, reject) =>
      db.close((e) => (e ? reject(e) : resolve())),
    );
  let input, output;
  try {
    input = await open(source);
    await new Promise((resolve, reject) =>
      input.run("VACUUM INTO ?", [destination], (e) =>
        e ? reject(e) : resolve(),
      ),
    );
    fs.chmodSync(destination, 0o600);
    output = await open(destination);
    const row = await new Promise((resolve, reject) =>
      output.get("PRAGMA integrity_check", (e, r) =>
        e ? reject(e) : resolve(r),
      ),
    );
    if (!row || Object.values(row)[0] !== "ok")
      throw Error("SNAPSHOT_INTEGRITY_FAILED");
    const digest = await new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(destination);
      stream.on("error", reject);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
    });
    return { status: "PASS", file: path.basename(destination), sha256: digest };
  } finally {
    if (output) await close(output);
    if (input) await close(input);
  }
}
if (require.main === module) {
  const destination = process.argv[2];
  if (
    !/^\/app\/data\/\.deployment-backups\/2\.2\.0-rc\.[1-9][0-9]*\.db$/.test(
      destination || "",
    )
  )
    throw Error("INVALID_SNAPSHOT_DESTINATION");
  snapshot(
    "/app/data/database.db",
    destination,
    require("/app/node_modules/sqlite3"),
  )
    .then((r) => console.log(JSON.stringify(r)))
    .catch(() => {
      console.error("SQLITE_SNAPSHOT_FAILED");
      process.exitCode = 1;
    });
}
module.exports = { snapshot };
