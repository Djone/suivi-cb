const { createHash } = require('node:crypto');
const digest = data => 'sha256:' + createHash('sha256').update(data).digest('hex');
const normalize = tag => tag.replace(/^docker\.io\/library\//, '');

function archiveImageId(files, tags, configDigest) {
  if (!files.has('index.json')) return configDigest; // Legacy Docker archive.
  const index = JSON.parse(files.get('index.json'));
  const roots = index.manifests.filter(entry => tags.some(tag =>
    normalize(entry.annotations?.['io.containerd.image.name'] || '') === normalize(tag)));
  function containsConfig(entry, depth = 0) {
    if (depth > 32 || !/^sha256:[a-f0-9]{64}$/.test(entry.digest)) throw new Error('Invalid OCI descriptor.');
    const bytes = files.get('blobs/sha256/' + entry.digest.slice(7));
    if (!bytes || digest(bytes) !== entry.digest) throw new Error('OCI blob missing or corrupted.');
    const node = JSON.parse(bytes);
    if (node.manifests) return node.manifests.some(child => containsConfig(child, depth + 1));
    return node.config?.digest === configDigest;
  }
  const matching = roots.filter(entry => containsConfig(entry));
  if (matching.length !== 1) throw new Error('Cannot bind archive tag to OCI image configuration.');
  return matching[0].digest;
}

module.exports = { archiveImageId };
