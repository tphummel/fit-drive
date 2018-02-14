'use strict'

function send (opts, cb) {
  console.log(`
    mode: stdout
    email sent to: ${opts.to}
    body: ${opts.body}
  `)
  return setImmediate(cb)
}

module.exports = { send }
