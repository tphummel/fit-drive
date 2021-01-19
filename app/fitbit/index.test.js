'use strict'

const tap = require('tap')
const proxyquire = require('proxyquire')
const sinon = require('sinon')

tap.test('fitbit authorizeVerify (400 no querystring)', function (t) {
  process.env.SESSION_JWT_SECRET = 'sessionsecret'

  const lib = proxyquire('.', {})

  const email = 'tphummel@gmail.com'

  const req = {
    user: {
      email: email
    }
    // missing 'query'
  }

  const res = {
    headers: {},
    set: sinon.spy(),
    status: sinon.spy(() => {
      return res
    }),
    send: () => {
      t.equal(res.set.callCount, 0)
      t.equal(res.status.callCount, 1)

      const observedResponseCode = res.status.getCall(0).args[0]
      t.equal(observedResponseCode, 400)

      t.end()
    }
  }

  lib.authorizeVerify(req, res)
})

tap.test('fitbit authorizeVerify (400 no code in querystring)', function (t) {
  process.env.SESSION_JWT_SECRET = 'sessionsecret'

  const lib = proxyquire('.', {})

  const email = 'tphummel@gmail.com'

  const req = {
    user: {
      email: email
    },
    query: {
      other: '123'
      // missing 'code'
    }
  }

  const res = {
    headers: {},
    set: sinon.spy(),
    status: sinon.spy(() => {
      return res
    }),
    send: () => {
      t.equal(res.set.callCount, 0)
      t.equal(res.status.callCount, 1)

      const observedResponseCode = res.status.getCall(0).args[0]
      t.equal(observedResponseCode, 400)

      t.end()
    }
  }

  lib.authorizeVerify(req, res)
})

tap.test('fitbit authorizeVerify (w/ active session)', function (t) {
  process.env.FITBIT_OAUTH_CLIENT_ID = 'fitbitclientid'
  process.env.FITBIT_OAUTH_CLIENT_SECRET = 'fitbitclientsecret'

  process.env.SESSION_JWT_SECRET = 'sessionsecret'

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
      console.log('called saveAuthorization spy')
      return setImmediate(cb, null)
    }),
    sgConcat: sinon.spy((opts, cb) => {
      const mockErr = null
      const mockRes = { statusCode: 200 }

      return setImmediate(cb, mockErr, mockRes, mockResBodyParsed)
    })
  }

  const lib = proxyquire('.', {
    '../user': {
      saveAuthorization: spies.saveAuthorization
    },
    'simple-get': {
      concat: spies.sgConcat
    }
  })

  const email = 'tphummel@gmail.com'
  const fitbitAuthoCode = 'autho-code-from-fitbit'

  const req = {
    user: {
      email: email
    },
    query: {
      code: fitbitAuthoCode
    }
  }

  const res = {
    headers: {},
    set: sinon.spy(),
    status: sinon.spy(() => {
      return res
    }),
    send: () => {
      console.log('called send')

      const observedResponseCode = res.status.getCall(0).args[0]
      t.equal(observedResponseCode, 307)

      const observedSetHeader = res.set.getCall(0).args
      t.equal(observedSetHeader[0], 'location')
      t.equal(observedSetHeader[1], '/home')

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

      t.end()
    }
  }

  lib.authorizeVerify(req, res)
})
