'use strict'

const url = require('url')

const tap = require('tap')
const get = require('simple-get')
const jwt = require('jsonwebtoken')
const sinon = require('sinon')
const proxyquire = require('proxyquire').noPreserveCache()

const port = '10001'

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

// post /login new user

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
        console.log('end')
        t.ifErr(err)
        t.end()
      })
    })
  })
})

// GET /login?token=expired
// GET /login?token=tampered

tap.test('GET /login?token=invalid', function (t) {
  const lib = proxyquire('..', {})
  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    get.get({
      url: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: 'login',
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

tap.test('GET /login?token=valid', function (t) {
  const lib = proxyquire('..', {})
  const server = lib.start(lib.app, port, (err) => {
    t.ifErr(err)

    get.get({
      url: url.format({
        protocol: 'http',
        hostname: 'localhost',
        pathname: 'login',
        port: port,
        query: {
          token: jwt.sign({}, process.env.LOGIN_JWT_SECRET)
        }
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
