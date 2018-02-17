'use strict'

const url = require('url')

const tap = require('tap')
const get = require('simple-get')
const http = require('http')
const jwt = require('jsonwebtoken')
const cookie = require('cookie')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noPreserveCache()

process.setMaxListeners(0)

const port = '10001'

process.env.LOGIN_JWT_SECRET = 'loginsecret'
process.env.SESSION_JWT_SECRET = 'sessionsecret'

// TODO:
// to get to -100, may need to test NODE_ENV logging modes
// development
// production

tap.test('GET /', function (t) {
  const lib = require('.')
  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    get({
      url: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/',
        port: port
      })
    }, (err, res) => {
      t.ifErr(err)
      t.equal(res.statusCode, 200)

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    })
  })
})

tap.test('GET /login', function (t) {
  const lib = require('.')
  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    get({
      url: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: 'login',
        port: port
      })
    }, (err, res) => {
      t.ifErr(err)
      t.equal(res.statusCode, 200)

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    })
  })
})

tap.test('POST /login (existing user)', function (t) {
  const Token = require('./app/token')

  const spies = {
    findUser: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, {
        email: email
      })
    }),
    createUser: sinon.spy(),
    sendLoginEmail: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, {})
    })
  }

  const lib = proxyquire('.', {
    './app/user': {
      findUser: spies.findUser,
      createUser: spies.createUser
    },
    './app/token': {
      createLoginToken: sinon.spy(Token, 'createLoginToken')
    },
    './app/email': {
      sendLoginEmail: spies.sendLoginEmail
    }
  })
  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    const email = 'tphummel@gmail.com'

    get.post({
      url: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: 'login',
        port: port
      }),
      form: {
        email: email
      }
    }, (err, res) => {
      t.ifErr(err)

      t.equal(spies.findUser.callCount, 1)
      t.ok(spies.findUser.calledWith({email}))
      t.equal(Token.createLoginToken.callCount, 1)
      t.ok(Token.createLoginToken.calledWith({email}))
      t.equal(spies.createUser.callCount, 0)
      t.equal(spies.sendLoginEmail.callCount, 1)

      t.equal(res.statusCode, 202)

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    })
  })
})

tap.test('POST /login (new user)', function (t) {
  const Token = require('./app/token')

  const spies = {
    findUser: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, null)
    }),
    createUser: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, {
        email: email
      })
    }),
    sendLoginEmail: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, {})
    })
  }

  const lib = proxyquire('.', {
    './app/user': {
      findUser: spies.findUser,
      createUser: spies.createUser
    },
    './app/token': {
      createLoginToken: sinon.spy(Token, 'createLoginToken')
    },
    './app/email': {
      sendLoginEmail: spies.sendLoginEmail
    }
  })
  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    const email = 'tphummel@gmail.com'

    get.post({
      url: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: 'login',
        port: port
      }),
      form: {
        email: email
      }
    }, (err, res) => {
      t.ifErr(err)

      t.equal(spies.findUser.callCount, 1)
      t.ok(spies.findUser.calledWith({email}))
      t.equal(spies.createUser.callCount, 1)
      t.ok(spies.createUser.calledWith({email}))
      t.equal(Token.createLoginToken.callCount, 1)
      t.ok(Token.createLoginToken.calledWith({email}))
      t.equal(spies.sendLoginEmail.callCount, 1)

      t.equal(res.statusCode, 202)

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    })
  })
})

tap.test('POST /login (missing email)', function (t) {
  const lib = require('.')
  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    get.post({
      url: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: 'login',
        port: port
      }),
      form: {}
    }, (err, res) => {
      t.ifErr(err)

      t.equal(res.statusCode, 400)

      // TODO: does not call database to lookup user by email
      // TODO: does not send email

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    })
  })
})

tap.test('POST /login (malformed email)', function (t) {
  const lib = require('.')
  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    get.post({
      url: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: 'login',
        port: port
      }),
      form: {
        email: 'tomhummel'
      }
    }, (err, res) => {
      t.ifErr(err)

      t.equal(res.statusCode, 422)

      // TODO: does not call database to lookup user by email
      // TODO: does not send email

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    })
  })
})

// TODO: GET /login?token=expired
// TODO: GET /login?token=tampered

tap.test('GET /login-verify?token=invalid', function (t) {
  const lib = proxyquire('.', {})
  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    get.get({
      url: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: 'login-verify',
        port: port,
        query: {
          token: 'invalid'
        }
      })
    }, (err, res) => {
      t.ifErr(err)

      t.equal(res.statusCode, 401)

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    })
  })
})

tap.test('GET /login-verify?token=valid', function (t) {
  const Token = require('./app/token')

  const lib = proxyquire('.', {
    './app/token': {
      createSessionToken: sinon.spy(Token, 'createSessionToken')
    }
  })

  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    const email = 'tphummel@gmail.com'

    // using http.request instead of simple-get
    // because i want to examine the redirect and set-cookie header
    http.request(url.format({
      protocol: 'http',
      hostname: 'localhost',
      pathname: 'login-verify',
      port: port,
      query: {
        token: jwt.sign({
          email: email
        }, process.env.LOGIN_JWT_SECRET)
      }
    }), (res) => {
      t.ifErr(err)

      t.equal(res.statusCode, 307)
      t.equal(res.headers.location, '/home')
      t.equal(Token.createSessionToken.callCount, 1)

      t.ok(res.headers['set-cookie'][0], 'a cookie was set')

      const expectedCookieNamePattern = /^sessionPayload/
      t.ok(expectedCookieNamePattern.test(res.headers['set-cookie'][0]))

      let observedCookie
      try {
        observedCookie = cookie.parse(res.headers['set-cookie'][0])
      } catch (e) {
        t.fail(e)
      }

      jwt.verify(observedCookie.sessionPayload, process.env.SESSION_JWT_SECRET, (err, payload) => {
        t.ifErr(err)

        t.equal(payload.email, email)

        server.close((err) => {
          t.ifErr(err)
          t.end()
        })
      })
    }).end()
  })
})

tap.test('GET /logout (w/ active session)', function (t) {
  const lib = proxyquire('.', {})

  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    http.request({
      method: 'GET',
      path: '/logout',
      port: port,
      headers: {
        cookie: cookie.serialize(
          'sessionPayload',
          jwt.sign({
            email: 'tphummel@gmail.com'
          }, process.env.SESSION_JWT_SECRET)
        )
      }
    }, (res) => {
      t.equal(res.statusCode, 307)
      t.equal(res.headers.location, '/login')

      t.ok(res.headers['set-cookie'][0], 'a cookie was set')

      let observedCookie
      try {
        observedCookie = cookie.parse(res.headers['set-cookie'][0])
      } catch (e) {
        t.fail(e)
      }

      const sessionPayloadIsEmptyString = observedCookie.sessionPayload === ''
      t.ok(sessionPayloadIsEmptyString)

      const cookieExpiresInThePast = new Date(observedCookie.Expires) < new Date()
      t.ok(cookieExpiresInThePast)

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    }).end()
  })
})

tap.test('POST /settings/delete-account (w/ active session)', function (t) {
  const spies = {
    deleteUser: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null)
    }),
    findUser: sinon.spy()
  }

  const lib = proxyquire('.', {
    './app/user': {
      deleteUser: spies.deleteUser,
      findUser: spies.findUser
    }
  })

  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    const email = 'tphummel@gmail.com'

    http.request({
      method: 'POST',
      path: '/settings/delete-account',
      port: port,
      headers: {
        cookie: cookie.serialize(
          'sessionPayload',
          jwt.sign({
            email: email
          }, process.env.SESSION_JWT_SECRET)
        )
      }
    }, (res) => {
      t.equal(spies.deleteUser.callCount, 1)
      t.ok(spies.deleteUser.calledWith({email}))
      t.equal(spies.findUser.callCount, 0)
      t.equal(res.statusCode, 307)
      t.equal(res.headers.location, '/')

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    }).end()
  })
})

tap.test('GET /authorize/fitbit (w/ active session)', function (t) {
  process.env.FITBIT_OAUTH_CLIENT_ID = 'fitbitclientid'
  const lib = require('.')

  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    const email = 'tphummel@gmail.com'

    http.request({
      method: 'GET',
      path: '/authorize/fitbit',
      port: port,
      headers: {
        cookie: cookie.serialize(
          'sessionPayload',
          jwt.sign({
            email: email
          }, process.env.SESSION_JWT_SECRET)
        )
      }
    }, (res) => {
      t.equal(res.statusCode, 302)
      const parseQueryString = true
      const redirectUrl = url.parse(res.headers.location, parseQueryString)

      t.equal(redirectUrl.hostname, 'www.fitbit.com')
      t.equal(redirectUrl.pathname, '/oauth2/authorize')
      t.equal(redirectUrl.query.client_id, process.env.FITBIT_OAUTH_CLIENT_ID)

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    }).end()
  })
})

tap.test('GET /authorize-verify/fitbit (w/ active session)', function (t) {
  process.env.FITBIT_OAUTH_CLIENT_ID = 'fitbitclientid'
  process.env.FITBIT_OAUTH_CLIENT_SECRET = 'fitbitclientsecret'

  const mockResBodyParsed = {
    access_token: 'my_access_token_jwt',
    expires_in: 28800,
    refresh_token: 'my_refresh_token_64char',
    scope: 'weight heartrate sleep activity nutrition profile location',
    token_type: 'Bearer',
    user_id: 'my_user_id'
  }

  const spies = {
    saveAuthorization: sinon.spy((autho, cb) => {
      return setImmediate(cb, null)
    }),
    sgConcat: sinon.spy((opts, cb) => {
      const mockErr = null
      const mockRes = {statusCode: 200}

      return setImmediate(cb, mockErr, mockRes, mockResBodyParsed)
    })
  }

  const lib = proxyquire('.', {
    './app/user': {
      saveAuthorization: spies.saveAuthorization
    },
    'simple-get': {
      concat: spies.sgConcat
    }
  })

  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    const email = 'tphummel@gmail.com'
    const fitbitAuthoCode = 'autho-code-from-fitbit'

    // http://localhost:8000/authorize-verify/fitbit?code=f5ec899b665aed67abd99b108660af3ce7cbff6c

    http.request({
      method: 'GET',
      path: `/authorize-verify/fitbit?code=${fitbitAuthoCode}`,
      port: port,
      headers: {
        cookie: cookie.serialize(
          'sessionPayload',
          jwt.sign({
            email: email
          }, process.env.SESSION_JWT_SECRET)
        )
      }
    }, (res) => {
      t.equal(res.statusCode, 307)
      t.equal(res.headers.location, '/home')

      t.equal(spies.saveAuthorization.callCount, 1)

      const spiedSaveAuthoCall = spies.saveAuthorization.getCall(0).args[0]

      t.equal(spiedSaveAuthoCall.name, 'fitbit')
      t.equal(spiedSaveAuthoCall.refreshToken, mockResBodyParsed.refresh_token)
      t.equal(spiedSaveAuthoCall.accessToken, mockResBodyParsed.access_token)
      t.equal(spiedSaveAuthoCall.scope, mockResBodyParsed.scope)
      t.equal(spiedSaveAuthoCall.userId, mockResBodyParsed.user_id)
      t.equal(spiedSaveAuthoCall.email, email)
      t.equal(spiedSaveAuthoCall.tokenType, mockResBodyParsed.token_type)

      t.equal(spies.sgConcat.callCount, 1)

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    }).end()
  })
})
