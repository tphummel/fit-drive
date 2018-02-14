'use strict'

const tap = require('tap')
const proxyquire = require('proxyquire')

tap.test((t) => {
  process.env.EMAIL_MODE = 'stdout'
  const lib = proxyquire('.', {
    './stdout': {
      send: (opts, cb) => { return setImmediate(cb) }
    }
  })

  lib.sendLoginEmail({
    email: 'tphummel@gmail.com',
    token: 'proof'
  }, (err) => {
    t.ifErr(err)

    t.end()
  })
})
