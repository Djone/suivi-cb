const fs = require('node:fs');

function metadata(version, builtAt) {
  if (!/^\d+\.\d+\.\d+(?:-rc\.[1-9]\d*)?$/.test(version)) throw new Error('Invalid release version');
  if (!builtAt || new Date(builtAt).toISOString() !== builtAt) throw new Error('Invalid build timestamp');
  return Object.entries({ APP_VERSION: version, APP_BUILD_TIME: builtAt, APP_ENV: 'production' })
    .map(([key, value]) => `export const ${key} = ${JSON.stringify(value)};`).join('\n') + '\n';
}

function productionEnvironment(content, version) {
  if (!/^\d+\.\d+\.\d+(?:-rc\.[1-9]\d*)?$/.test(version)) throw new Error('Invalid release version');
  const field = /^(\s*version:\s*)['"][^'"]+['"]/gm;
  if ([...content.matchAll(field)].length !== 1) throw new Error('Expected one production version field');
  return content.replace(field, (_, prefix) => prefix + JSON.stringify(version));
}

if (require.main === module && process.env.APP_VERSION) {
  const version = metadata(process.env.APP_VERSION, process.env.APP_BUILD_TIME);
  const envPath = 'src/environments/environment.prod.ts';
  const environment = productionEnvironment(fs.readFileSync(envPath, 'utf8'), process.env.APP_VERSION);
  fs.writeFileSync('src/app/version.ts', version);
  fs.writeFileSync(envPath, environment);
}
module.exports = { metadata, productionEnvironment };
