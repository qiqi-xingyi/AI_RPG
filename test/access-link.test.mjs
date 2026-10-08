import test from 'node:test';
import assert from 'node:assert/strict';
import { takeAccessLink } from '../public/access-link.js';
function link(fragment) {
  const location = new URL('https://playtest.example/?theme=moon#' + fragment), cleared = [];
  const history = { replaceState: (...args) => cleared.push(args[2]) };
  return { read: () => takeAccessLink(location, history), cleared };
}
test('share and dedicated link credentials are removed from the address before login and use separate endpoints', () => {
  const invite = link('invite=FRIEND-CODE');
  assert.deepEqual(invite.read(), { path: '/api/playtest/login', data: { code: 'FRIEND-CODE' } });
  assert.deepEqual(invite.cleared, ['/?theme=moon']);
  const owner = link('owner=' + 'A'.repeat(43));
  assert.deepEqual(owner.read(), { path: '/api/playtest/owner', data: { token: 'A'.repeat(43) } });
  assert.deepEqual(owner.cleared, ['/?theme=moon']);
});
test('incomplete or ambiguous credentials fail without silently using trial access', () => {
  for (const fragment of ['owner=short', 'owner=' + 'A'.repeat(43) + '&invite=CODE', 'invite=ONE&invite=TWO', 'owner=' + 'A'.repeat(43) + '&owner=' + 'B'.repeat(43)]) {
    const value = link(fragment); assert.throws(value.read); assert.deepEqual(value.cleared, ['/?theme=moon']);
  }
  const plain = link('story'); assert.equal(plain.read(), null); assert.deepEqual(plain.cleared, []);
});
