'use strict'

process.env.EMAIL_MODE = process.env.EMAIL_MODE || 'stdout'

console.log(`using email mode: ${process.env.EMAIL_MODE}`)
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
