'use strict'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const bole = require('bole')

const pkg = require('./package.json')
const logLevels = ['error', 'warn', 'info', 'debug']

if (process.env.NODE_ENV === 'production') {
  bole.output({
    level: 'info',
    stream: process.stdout
  })
  const logger = bole(pkg.name)

  console.log = logger.info

  logLevels.forEach((level) => { console[level] = logger[level] })
} else if (['test', 'development'].includes(process.env.NODE_ENV)) {
  logLevels.forEach((level) => {
    if (level === 'error') return
    console[level] = console.log
  })
} else {
  console.error(`
    process.env.NODE_ENV is set to an invalid value: ${process.env.NODE_ENV}
    it must be one of: 'production', 'development', or 'test'
  `)
  process.exit(1)
}

process.on('uncaughtException', function onUncaughtException (err) {
  console.error(err)
  process.exit(1)
})

const express = require('express')
const expressJwt = require('express-jwt')
const waterfall = require('run-waterfall')

const User = require('./app/user')
const Token = require('./app/token')
const Email = require('./app/email')

const app = express()
module.exports = app

app.use(require('body-parser').urlencoded({extended: true}))
app.use(require('cookie-parser')())

if (process.env.NODE_ENV !== 'test') {
  app.use(function requestLogger (req, res, next) {
    console.info(`${req.method} ${req.path}`)
    return next()
  })
}

const loginToken = expressJwt({
  secret: process.env.LOGIN_JWT_SECRET || 'login-token-secret',
  requestProperty: 'loginToken',
  credentialsRequired: true,
  getToken: (req) => {
    if (req.query) return req.query.token
    return null
  }
})

const sessionToken = expressJwt({
  secret: process.env.SESSION_JWT_SECRET || 'session-cookie-secret',
  credentialsRequired: false,
  getToken: (req) => {
    if (req.cookies) return req.cookies.webAppSession
    return null
  }
})

app.get('/', (req, res) => {
  return res.send('/')
})

app.get('/login', (req, res) => {
  return res.send('/login')
})

app.get('/login-verify', loginToken, (req, res) => {
  Token.createSessionToken({email: req.loginToken.email}, (err, token) => {
    if (err) return res.status(500).send(err)

    res.cookie('sessionPayload', token)
    return res.status(200).send('/login-verify')
  })
})

app.post('/login', (req, res) => {
  if (!req.body || !req.body.email) return res.status(400).send('email is required')

  const inputEmail = req.body.email
  const isValidEmail = /.+@.+\..+/.test(inputEmail)

  if (!isValidEmail) return res.status(422).send('email is malformed')

  waterfall([
    function findExistingUser (cb) {
      console.debug('findExistingUser')
      User.findUser({email: inputEmail}, function (err, user) {
        return cb(err, {user})
      })
    },
    function createUserIfNotFound ({user}, cb) {
      if (user) return setImmediate(cb, null, {user})

      User.createUser({email: inputEmail}, function (err, user) {
        return cb(err, {user})
      })
    },
    function createLoginTokenForUser ({user}, cb) {
      console.debug('createLoginTokenForUser')
      Token.createLoginToken({email: user.email}, (err, token) => {
        return cb(err, {user, token})
      })
    },
    function sendLoginEmailToUser ({user, token}, cb) {
      Email.sendLoginEmail({user, token}, (err) => {
        return cb(err, {user})
      })
    }
  ], function (err, {user}) {
    if (err) return res.status(500).send(err)

    return res.status(202).send('login request received')
  })
})

app.get('/home', sessionToken, (req, res) => {
  return res.send('/home')
})

app.get('/logout', sessionToken, (req, res) => {
  // clear cookie
  // if clear all sessions, set a invalidation for the user
  // the other option is jwt secret per user and rotate it
  return res.send('/logout')
})

app.get('/settings', sessionToken, (req, res) => {
  return res.send('/settings')
})

app.get('/settings/billing', sessionToken, (req, res) => {
  return res.send('/settings/billing')
})

function start (app, port, cb) {
  return app.listen(port, cb)
}

function close (server, cb) {
  return server.close()
}

module.exports = {
  app: app,
  start: start,
  close: close
}

if (!module.parent) {
  const port = process.env.PORT || '8000'
  start(app, port, (err) => {
    if (err) console.error(err) && process.exit(1)
    console.log(`listening on port ${port}`)
  })
}
