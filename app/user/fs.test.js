'use strict'

const lib = require('./fs')
const tap = require('tap')

tap.test('create and find new user', (t) => {
  const newUser = { email: 'tphummel@gmail.com' }
  lib.createUser(newUser, (err, createdUser) => {
    t.ifErr(err)

    lib.findUser(newUser, (err, foundUser) => {
      t.ifErr(err)

      t.ok(foundUser)
      t.equal(foundUser.email, newUser.email)

      lib.saveAuthorization({
        email: foundUser.email,
        name: 'externalService'
      }, (err, authoUser) => {
        t.ifErr(err)

        t.ok(authoUser.authorizations.externalService)

        lib.deleteUser(authoUser, (err) => {
          t.ifErr(err)

          lib.findUser(authoUser, (err, shouldBeEmpty) => {
            t.ifErr(err)
            t.notOk(shouldBeEmpty)

            t.end()
          })
        })
      })
    })
  })
})
