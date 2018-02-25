'use strict'

const User = require('../app/user')

User.findUser({email: process.env.EMAIL}, (err, user) => {
  if (err) console.error(err)

  console.log(user)

  // function refreshToken (url, refreshToken, cb) {
    // get a new refresh and access token for url.
    // save user with new access token
    // pass new access token to callback
  // }

  // const refreshFns = Object.keys(user.authorizations).map(function (name) {
  //   return refreshToken.bind(null, someUrl, user.authorizations[name].refresh_token)
  // })

  // runParallel(refreshFns, function (err, results) {
    // i now have saved refresh tokens
    // i now have new access tokens

    // do work with access tokens
  // })
})
