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

const user = require('./app/user')
const token = require('./app/token')
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
  resultProperty: 'loginToken',
  credentialsRequired: false,
  getToken: (req) => {
    if (req.query) return req.query.token
    return null
  }
})
// app.use(loginToken)

const sessionToken = expressJwt({
  secret: process.env.SESSION_JWT_SECRET || 'session-cookie-secret',
  credentialsRequired: false,
  getToken: (req) => {
    if (req.cookies) return req.cookies.webAppSession
    return null
  }
})
// app.use(sessionToken)

app.get('/', (req, res) => {
  return res.send('/')
})

app.get('/login', loginToken, function (err, req, res, next) {
  if (err) return res.status(401).send(err.name)
  return next()
}, (req, res) => {
  return res.send('/login')
})

app.post('/login', (req, res) => {
  if (!req.body || !req.body.email) return res.status(400).send('email is required')

  const email = req.body.email
  const isValidEmail = /.+@.+\..+/.test(email)

  if (!isValidEmail) return res.status(422).send('email is malformed')

  waterfall([
    function findExistingUser (cb) {
      console.debug('findExistingUser')
      user.findUser({email}, function (err, user) {
        return cb(err, {user})
      })
    },
    function createLoginTokenForUser ({user}, cb) {
      console.debug('createLoginTokenForUser')
      token.createLoginToken({email: user.email}, (err, token) => {
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
    if (user) return res.status(202).send('login request received')
    return res.status(202).send('/login')
  })
})

app.get('/home', sessionToken, (req, res) => {
  // jwt token cookie required
  return res.send('/home')
})

app.get('/logout', (req, res) => {
  // clear cookie
  // if clear all sessions, set a invalidation for the user
  // the other option is jwt secret per user and rotate it
  return res.send('/logout')
})

app.get('/settings', (req, res) => {
  // jwt token cookie required
  return res.send('/settings')
})

app.get('/settings/billing', (req, res) => {
  // jwt token cookie required
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
