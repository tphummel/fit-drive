'use strict'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'
process.env.PORT = process.env.PORT || '8000'

const bole = require('bole')
const url = require('url')
const simpleGet = require('simple-get')

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
  credentialsRequired: true,
  getToken: (req) => {
    if (req.cookies) return req.cookies.sessionPayload
    return null
  }
})

app.get('/', (req, res) => {
  return res.status(200).send(`
<p>/</p>
<a href="/login">login</a>
`)
})

app.get('/login', (req, res) => {
  return res.status(200).send(`
<p>/login</p>
<form action="" method="post">
  <input type="text" name="email" />
  <input type="submit" value="login" />
</form>
    `)
})

app.get('/login-verify', loginToken, (req, res) => {
  Token.createSessionToken({email: req.loginToken.email}, (err, token) => {
    if (err) return res.status(500).send(err)

    res.cookie('sessionPayload', token)
    res.set('Location', '/home')
    return res.status(307).send('')
  })
})

app.post('/login', (req, res) => {
  if (!req.body || !req.body.email) return res.status(400).send('email is required')

  const inputEmail = req.body.email
  const isValidEmail = /.+@.+\..+/.test(inputEmail)

  if (!isValidEmail) return res.status(422).send('email is malformed')

  waterfall([
    function findExistingUser (cb) {
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
  return res.send(`
<p>/home</p>
<a href="/authorize/fitbit">Authorize Fitbit</a>
<a href="/authorize/drive">Authorize Google Drive</a>
`)
})

app.get('/logout', sessionToken, (req, res) => {
  res.clearCookie('sessionPayload')
  res.set('location', '/login')
  return res.status(307).send('/logout')
})

app.post('/settings/delete-account', sessionToken, (req, res) => {
  User.deleteUser({email: req.user.email}, (err) => {
    if (err) return res.status(500).send(err)

    res.clearCookie('sessionPayload')
    res.set('location', '/')
    return res.status(307).send('/settings')
  })
})

app.get('/settings', sessionToken, (req, res) => {
  return res.send('/settings')
})

app.get('/settings/billing', sessionToken, (req, res) => {
  return res.send('/settings/billing')
})

app.get('/authorize/fitbit', sessionToken, (req, res) => {
  const desiredScopes = [
    'activity', 'heartrate', 'location',
    'nutrition', 'sleep', 'weight',
    'profile'
  ]

  const fitbitAuthorizationUrl = url.format({
    protocol: 'https',
    hostname: 'www.fitbit.com',
    pathname: 'oauth2/authorize',
    query: {
      client_id: process.env.FITBIT_OAUTH_CLIENT_ID,
      response_type: 'code',
      scope: desiredScopes.join(' '),
      redirect_uri: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/authorize-verify/fitbit',
        port: process.env.PORT
      })
    }
  })

  res.set('location', fitbitAuthorizationUrl)
  res.status(302).send()
})

app.get('/authorize/drive', sessionToken, (req, res) => {
  const desiredScopes = [
    'https://www.googleapis.com/auth/drive.file'
  ]

  const googleAuthorizationUrl = url.format({
    protocol: 'https',
    hostname: 'accounts.google.com',
    pathname: '/o/oauth2/v2/auth',
    query: {
      client_id: process.env.DRIVE_OAUTH_CLIENT_ID,
      response_type: 'code',
      access_type: 'offline',
      scope: desiredScopes.join(' '),
      redirect_uri: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/authorize-verify/drive',
        port: process.env.PORT
      })
    }
  })

  res.set('location', googleAuthorizationUrl)
  res.status(302).send()
})

app.get('/authorize-verify/fitbit', sessionToken, (req, res) => {
  if (!req.query) return res.status(400).send('bad inputs')
  if (!req.query.code) return res.status(400).send('bad inputs')

  const authoCode = req.query.code

  simpleGet.concat({
    method: 'POST',
    url: url.format({
      protocol: 'https',
      hostname: 'api.fitbit.com',
      pathname: '/oauth2/token',
      auth: [
        process.env.FITBIT_OAUTH_CLIENT_ID,
        process.env.FITBIT_OAUTH_CLIENT_SECRET
      ].join(':')
    }),
    json: true,
    form: {
      client_id: process.env.FITBIT_OAUTH_CLIENT_ID,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:8000/authorize-verify/fitbit',
      code: authoCode
    }
  }, function onFitbitTokensResponse (err, tokenRes, tokenData) {
    if (err) return res.status(500).send(err)

    // handle case where we don't get 200 back from fitbit
    // console.log('tokenRes.statusCode', tokenRes.statusCode)
    // console.log('tokenData', tokenData)

    const authorization = {
      name: 'fitbit',
      refreshToken: tokenData.refresh_token,
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
      userId: tokenData.user_id,
      email: req.user.email,
      tokenType: tokenData.token_type
    }

    User.saveAuthorization(authorization, (err) => {
      if (err) return res.status(500).send(err)

      res.set('location', '/home')
      res.status(307).send()
    })
  })
})

// http://localhost:8000/authorize-verify/drive?code=4/AACd6wo9mCP8uHGOBQAYAg0T7WWA6J7GWHjR8MO-kCpUCF0tBS_v3IPT9w2KLw7733G4IxeuWFI3XTJ1lu7Nl_Q

app.get('/authorize-verify/drive', sessionToken, (req, res) => {
  if (!req.query) return res.status(400).send('bad inputs')
  if (!req.query.code) return res.status(400).send('bad inputs')

  const authoCode = req.query.code

  simpleGet.concat({
    method: 'POST',
    url: url.format({
      protocol: 'https',
      hostname: 'www.googleapis.com',
      pathname: '/oauth2/v4/token',
      auth: [
        process.env.DRIVE_OAUTH_CLIENT_ID,
        process.env.DRIVE_OAUTH_CLIENT_SECRET
      ].join(':')
    }),
    json: true,
    form: {
      client_id: process.env.DRIVE_OAUTH_CLIENT_ID,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:8000/authorize-verify/drive',
      code: authoCode
    }
  }, function onDriveTokensResponse (err, tokenRes, tokenData) {
    if (err) return res.status(500).send(err)
    // handle case where we don't get 200 back from drive
    console.log(tokenData)

    const authorization = {
      name: 'drive',
      refreshToken: tokenData.refresh_token,
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
      userId: tokenData.user_id,
      email: req.user.email,
      tokenType: tokenData.token_type
    }

    User.saveAuthorization(authorization, (err) => {
      if (err) return res.status(500).send(err)

      res.set('location', '/home')
      res.status(307).send()
    })
  })
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
  const port = process.env.PORT
  start(app, port, (err) => {
    if (err) console.error(err) && process.exit(1)
    console.log(`listening on port ${port}`)
  })
}
