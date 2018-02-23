'use strict'

const lib = require('./fs')
const tap = require('tap')

tap.test('create and find new user', (t) => {
  const newUser = {email: 'tphummel@gmail.com'}
  lib.createUser(newUser, (err, createdUser) => {
    t.ifErr(err)

    lib.findUser(newUser, (err, foundUser) => {
      t.ifErr(err)

      t.ok(foundUser)
      t.equal(foundUser.email, newUser.email)
      t.end()
    })
  })
})
