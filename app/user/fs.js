'use strict'

const fs = require('fs')
const path = require('path')

const modelName = 'user'
const tmpDir = path.resolve(__dirname, '../../tmp')
const dbPath = path.resolve(tmpDir, modelName)

function initDb (cb) {
  // get `mkdir -p` behavior
  fs.mkdir(tmpDir, (err) => {
    if (err && err.code !== 'EEXIST') return cb(err)

    fs.mkdir(dbPath, (err) => {
      if (err && err.code !== 'EEXIST') return cb(err)
      return cb(null)
    })
  })
}

function findUser ({email}, cb) {
  initDb((err) => {
    if (err) return cb(err)
    fs.readFile(path.resolve(dbPath, email), {}, (err, data) => {
      if (err) return cb(err)
      return cb(null, JSON.parse(data))
    })
  })
}

function createUser (user, cb) {
  initDb((err) => {
    if (err) return cb(err)

    fs.writeFile(
      path.resolve(dbPath, user.email),
      JSON.stringify(user), {}, (err) => {
        if (err) return cb(err)
        return cb(null, user)
      }
    )
  })
}

function saveAuthorization (opts, cb) { return setImmediate(cb, null) }

function deleteUser ({email}, cb) { return setImmediate(cb, null) }

module.exports = {
  findUser,
  createUser,
  saveAuthorization,
  deleteUser
}
