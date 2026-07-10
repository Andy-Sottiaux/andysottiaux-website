#!/usr/bin/env node

import { randomBytes, scrypt } from 'node:crypto'

const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)

const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '')
if (!password) {
  console.error('Read the control password from stdin.')
  process.exit(1)
}

const cost = 16_384
const blockSize = 8
const parallelization = 1
const salt = randomBytes(16)

const digest = await new Promise((resolve, reject) => {
  scrypt(password, salt, 64, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: 64 * 1024 * 1024,
  }, (error, derivedKey) => {
    if (error) reject(error)
    else resolve(derivedKey)
  })
})

console.log([
  'scrypt',
  cost,
  blockSize,
  parallelization,
  salt.toString('base64url'),
  digest.toString('base64url'),
].join('$'))
