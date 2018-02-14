'use strict'

process.env.EMAIL_MODE = process.env.EMAIL_MODE || 'stdout'

const transport = require(`./${process.env.EMAIL_MODE}`)

function sendLoginEmail ({email, token}, cb) {
  transport.send({
    to: email,
    body: `
Click here to log in: http://localhost:8000/login-verify?token=${token}
    `
  }, cb)
}

module.exports = {
  sendLoginEmail
}
