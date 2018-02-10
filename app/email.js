'use strict'

function sendLoginEmail ({email, token}, cb) { return setImmediate(cb, null) }

module.exports = {
  sendLoginEmail
}
