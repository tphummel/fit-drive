'use strict'

function createLoginToken ({email}, cb) { return setImmediate(cb, null, {}) }

function createSessionToken ({email}, cb) { return setImmediate(cb, null, {}) }

module.exports = {
  createLoginToken,
  createSessionToken
}
