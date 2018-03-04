'use strict'

const url = require('url')
const simpleGet = require('simple-get')
const User = require('../user')

function authorizeVerify (req, res) {
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
}

module.exports = {
  authorizeVerify
}
