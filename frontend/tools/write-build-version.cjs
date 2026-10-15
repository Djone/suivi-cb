const fs = require('node:fs');

function metadata(version, builtAt) {
  if (!/^\d+\.\d+\.\d+(?:-rc\.[1-9]\d*)?$/.test(version)) throw new Error('Invalid release version');
  if (!builtAt || new Date(builtAt).toISOString() !== builtAt) throw new Error('Invalid build timestamp');
  return Object.entries({ APP_VERSION: version, APP_BUILD_TIME: builtAt, APP_ENV: 'production' })
    .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`).join('\n') + '\n';
}

if (require.main === module && process.env.APP_VERSION) {
  fs.writeFileSync('src/app/version.ts', metadata(process.env.APP_VERSION, process.env.APP_BUILD_TIME));
}
module.exports = { metadata };
