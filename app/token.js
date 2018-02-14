'use strict'

const jwt = require('jsonwebtoken')

function createLoginToken ({email}, cb) {
  return jwt.sign({
    email
  }, process.env.LOGIN_JWT_SECRET, {
    expiresIn: '10m'
  }, cb)
}

function createSessionToken ({email}, cb) {
  return jwt.sign({
    email
  }, process.env.SESSION_JWT_SECRET, {
    expiresIn: '1d'
  }, cb)
}

module.exports = {
  createLoginToken,
  createSessionToken
}
