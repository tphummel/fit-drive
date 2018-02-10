'use strict'

function createLoginToken (email, cb) { return setImmediate(cb) }

function createSessionToken (email, cb) { return setImmediate(cb) }

module.exports = {
  createLoginToken,
  createSessionToken
}
