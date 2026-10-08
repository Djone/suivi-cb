const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { archiveImageId } = require('../oci-image-identity.cjs');
test('OCI index digest is bound to the exported tag and its distinct config digest', () => {
  const files = new Map();
  const config = 'sha256:' + 'a'.repeat(64);
  const blob = node => {
    const bytes = Buffer.from(JSON.stringify(node));
    const sha = createHash('sha256').update(bytes).digest('hex');
    files.set('blobs/sha256/' + sha, bytes);
    return { digest: 'sha256:' + sha };
  };
  const root = blob({ manifests: [blob({ config: { digest: config } })] });
  root.annotations = { 'io.containerd.image.name': 'docker.io/library/suivi-cb-preprod-backend:2.3.0-rc.1' };
  files.set('index.json', Buffer.from(JSON.stringify({ manifests: [root] })));
  const tags = ['suivi-cb-preprod-backend:2.3.0-rc.1'];
  assert.equal(archiveImageId(files, tags, config), root.digest);
  assert.notEqual(root.digest, config);
  assert.throws(() => archiveImageId(files, tags, 'sha256:' + 'b'.repeat(64)), /Cannot bind/);
  files.set('blobs/sha256/' + root.digest.slice(7), Buffer.from('{}'));
  assert.throws(() => archiveImageId(files, tags, config), /corrupted/);
});
test('legacy archive uses the configuration digest', () => {
  assert.equal(archiveImageId(new Map(), [], 'sha256:legacy'), 'sha256:legacy');
});
