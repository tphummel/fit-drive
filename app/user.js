'use strict'

function findUserByEmail (email, cb) { return setImmediate(cb) }

function createUser (email, cb) { return setImmediate(cb) }

module.exports = {
  findUserByEmail,
  createUser
}
