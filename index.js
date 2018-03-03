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

// custom flash middlware: https://gist.github.com/brianmacarthur/a4e3e0093d368aa8e423
app.use((req, res, next) => {
  // ensure flash is available to subsequent request then cleaned up
  if (req.cookies.flash) {
    res.locals.flash = req.cookies.flash
    res.clearCookie('flash')
  }
  return next()
})

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
  User.findUser(req.user, (err, user) => {
    if (err) return res.status(500).send(err)

    // if the database was empty or this user got deleted, this would log an error.
    // it means there is a valid session token in the browser but no matching user in db.
    // log it
    // handle it: clear the cookie, redirect to login page
    user.authorizations = user.authorizations || {}

    return res.send(`
      ${res.locals.flash
        ? `<p>${res.locals.flash.type}: ${res.locals.flash.message}</p>`
        : ``
      }
      <p>/home</p>
      <p>
        Fitbit: ${user.authorizations.fitbit ? `Authorized <form method="post" action="/deauthorize/fitbit"><input type="submit" value="Delete" /></form>` : `<a href="/authorize/fitbit">Authorize</a>`}
      </p>
      <hr>
      <p>
        Drive: ${user.authorizations.drive ? `Authorized <form method="post" action="/deauthorize/drive"><input type="submit" value="Delete" /></form>` : `<a href="/authorize/drive">Authorize</a>`}
      </p>
        ${user.authorizations.fitbit && user.authorizations.drive
          ? `
            <hr>
            <p>
              <form action="/authorizations-test" method="post">
                <input type="submit" value="Test Authorizations" />
              </form>
            </p>`
          : ``
        }
    `)
  })
})

app.post('/authorizations-test', sessionToken, (req, res) => {
  waterfall([
    function getLoggedInUser (cb) {
      return User.findUser(req.user, cb)
    },
    function refreshFitbit (user, cb) {
      if (!user.authorizations) { return cb(new Error('Fitbit Authorization Missing')) }
      if (!user.authorizations.fitbit) { return cb(new Error('Fitbit Authorization Missing')) }
      if (!user.authorizations.fitbit.refreshToken) { return cb(new Error('Fitbit Authorization Missing')) }

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
          grant_type: 'refresh_token',
          expires_in: 3600, // 1 hour
          refresh_token: user.authorizations.fitbit.refreshToken
        }
      }, (err, tokenRes, tokenData) => {
        if (tokenRes.statusCode >= 400) return cb(new Error(`Response ${tokenRes.StatusCode} received from fitbit`))
        return cb(err, user, tokenData)
      })
    },
    function saveFitbit (user, tokenData, cb) {
      const authorization = {
        name: 'fitbit',
        refreshToken: tokenData.refresh_token || user.authorizations.drive.refreshToken,
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        userId: tokenData.user_id,
        email: req.user.email,
        tokenType: tokenData.token_type
      }

      User.saveAuthorization(authorization, (err) => {
        return cb(err, user)
      })
    },
    function refreshDrive (user, cb) {
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
          client_secret: process.env.DRIVE_OAUTH_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: user.authorizations.drive.refreshToken
        }
      }, function onDriveTokensResponse (err, tokenRes, tokenData) {
        if (tokenRes.statusCode >= 400) return cb(new Error(`Response ${tokenRes.StatusCode} received from drive`))
        return cb(err, user, tokenData)
      })
    },
    function saveDrive (user, tokenData, cb) {
      const authorization = {
        name: 'drive',
        // refresh tokens are not always issued. restore the existing if not issued new
        // see: https://developers.google.com/identity/protocols/OAuth2WebServer#offline
        refreshToken: tokenData.refresh_token || user.authorizations.drive.refreshToken,
        accessToken: tokenData.access_token,
        scope: tokenData.scope,
        userId: tokenData.user_id,
        email: req.user.email,
        tokenType: tokenData.token_type
      }

      User.saveAuthorization(authorization, cb)
    }
  ], function onAuthoVerifyFinish (err) {
    let flash = {
      at: new Date()
    }

    if (err) {
      flash.type = 'error'
      flash.message = `
        authorization tests failed at ${flash.at}. please re-authorize and try again
      `
    } else {
      flash.type = 'success'
      flash.message = `authorization tests succeeded at ${flash.at}`
    }
    res.cookie('flash', flash)

    res.set('location', '/home')
    return res.status(302).send()
  })
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
      prompt: 'consent',
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

    // TODO: handle case where we don't get 200 back from fitbit

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
      client_secret: process.env.DRIVE_OAUTH_CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: 'http://localhost:8000/authorize-verify/drive',
      code: authoCode
    }
  }, function onDriveTokensResponse (err, tokenRes, tokenData) {
    if (err) return res.status(500).send(err)

    // TODO: handle case where we don't get 200 back from drive

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
