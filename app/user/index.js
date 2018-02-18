'use strict'

process.env.DB_MODE = process.env.DB_MODE || 'noop'

module.exports = require(`./${process.env.DB_MODE}`)
