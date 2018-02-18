'use strict'

function findUser ({email}, cb) { return setImmediate(cb, null) }

function createUser ({email}, cb) {
  return setImmediate(cb, null, {email})
}

function saveAuthorization (opts, cb) { return setImmediate(cb, null) }

function deleteUser ({email}, cb) { return setImmediate(cb, null) }

module.exports = {
  findUser,
  createUser,
  saveAuthorization,
  deleteUser
}
