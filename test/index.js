'use strict'

const url = require('url')

const tap = require('tap')
const get = require('simple-get')
const jwt = require('jsonwebtoken')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noPreserveCache()

const port = '10001'

process.env.LOGIN_JWT_SECRET = 'loginsecret'
process.env.SESSION_JWT_SECRET = 'sessionsecret'

// to get to -100, may need to test NODE_ENV logging modes
// development
// production

tap.test('GET /', function (t) {
  const lib = proxyquire('..', {})
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
  const lib = proxyquire('..', {})
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
  const spies = {
    findUser: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, {
        email: email
      })
    }),
    createUser: sinon.spy(),
    createLoginToken: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, {})
    }),
    sendLoginEmail: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, {})
    })
  }

  const lib = proxyquire('..', {
    './app/user': {
      findUser: spies.findUser,
      createUser: spies.createUser
    },
    './app/token': {
      createLoginToken: spies.createLoginToken
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
      t.equal(spies.createLoginToken.callCount, 1)
      t.ok(spies.createLoginToken.calledWith({email}))
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
  const spies = {
    findUser: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, null)
    }),
    createUser: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, {
        email: email
      })
    }),
    createLoginToken: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, {})
    }),
    sendLoginEmail: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, {})
    })
  }

  const lib = proxyquire('..', {
    './app/user': {
      findUser: spies.findUser,
      createUser: spies.createUser
    },
    './app/token': {
      createLoginToken: spies.createLoginToken
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
      t.equal(spies.createLoginToken.callCount, 1)
      t.ok(spies.createLoginToken.calledWith({email}))
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
  const lib = proxyquire('..', {})
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

      // does not call database to lookup user by email
      // does not send email

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    })
  })
})

tap.test('POST /login (malformed email)', function (t) {
  const lib = proxyquire('..', {})
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

      // does not call database to lookup user by email
      // does not send email

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    })
  })
})

// GET /login?token=expired
// GET /login?token=tampered

tap.test('GET /login-verify?token=invalid', function (t) {
  const lib = proxyquire('..', {})
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
  const spies = {
    createSessionToken: sinon.spy(({email}, cb) => {
      return setImmediate(cb, null, {email})
    })
  }

  const lib = proxyquire('..', {
    './app/token': {
      createSessionToken: spies.createSessionToken
    }
  })
  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    get.get({
      url: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: 'login-verify',
        port: port,
        query: {
          token: jwt.sign({
            email: 'tphummel@gmail.com'
          }, process.env.LOGIN_JWT_SECRET)
        }
      })
    }, (err, res) => {
      t.ifErr(err)

      t.equal(res.statusCode, 200)
      t.ok(res.headers['set-cookie'][0], 'a cookie was set')
      t.ok(/^webAppSession/.test(res.headers['set-cookie'][0]))

      server.close((err) => {
        t.ifErr(err)
        t.end()
      })
    })
  })
})
