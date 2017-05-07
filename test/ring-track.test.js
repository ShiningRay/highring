'use strict'

const t = require('tap')
const boot = require('./helper').boot
const farmhash = require('farmhash')

t.plan(2)

// boot two unrelated instance
boot(t, (one) => {
  boot(t, (two) => {
    var i
    const onePoints = one._hashring.mymeta().points
    var start = onePoints[0]
    var end = 0
    const twoPoints = two._hashring.mymeta().points
    for (i = 0; i < twoPoints.length; i++) {
      if (twoPoints[i] > start) {
        end = twoPoints[i]
        for (var k = 1; k < onePoints.length; k++) {
          if (onePoints[k] > end) {
            start = onePoints[k - 1]
            break
          }
        }
        if (start > onePoints[0]) {
          break
        }
      }
    }

    var key
    var hash
    i = 0
    do {
      key = 'hello' + i++
      hash = farmhash.hash32(key)
    } while (!(start < hash && hash < end))

    // now key will be allocated between the two
    // let's track it
    one.track(key)
      .on('move', function () {
        t.pass('move')
      })
      .on('replica', function () {
        t.fail('no replica events')
      })

    // let's join them in a cluster
    one.join([two.me()], function (err) {
      t.error(err, 'no error')
    })
  })
})
