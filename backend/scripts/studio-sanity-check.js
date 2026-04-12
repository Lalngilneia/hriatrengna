'use strict';

process.env.NODE_ENV = 'test';

const assert = require('assert/strict');

function check(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

check('app boots without syntax/runtime import errors', () => {
  const app = require('../src/app');
  assert.equal(typeof app, 'function');
});

check('public access helper exports expected API', () => {
  const access = require('../src/utils/public-access');
  assert.equal(typeof access.getPublicAccessState, 'function');
  assert.equal(typeof access.hasGracePeriodAccess, 'function');
});

check('studio entitlement helper exports expected API', () => {
  const entitlement = require('../src/utils/studio-entitlement');
  assert.equal(typeof entitlement.getStudioEntitlement, 'function');
});

check('album access endpoints are available', () => {
  const album = require('../src/controllers/album.controller');
  assert.equal(typeof album.listClaimed, 'function');
  assert.equal(typeof album.getOne, 'function');
  assert.equal(typeof album.update, 'function');
});

console.log('studio sanity check complete');
