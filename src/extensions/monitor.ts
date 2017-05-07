const LRU = require('lru-cache')
const from = require('from2')
const eos = require('end-of-stream')
const maxAge = 500

export default function monitoring (upring) {
  const lru = LRU({
    max: 100,
    maxAge
  })

  var streams = 0

  upring.add('ns:monitoring,cmd:memoryUsage', function (req, reply) {
    reply(null, process.memoryUsage())
  })

  upring.add('ns:monitoring,cmd:info', function (req, reply) {
    reply(null, Object.assign({
      id: upring.me(),
      upring: upring.mymeta().meta.upring
    }, upring.info))
  })

  function trace (req) {
    const key = req.key
    if (!key) {
      return
    }
    const hash = upring.hash(key)
    if (upring.allocatedToMe(hash)) {
      // max one value for each hash
      lru.set('' + hash, { key, hash })
    }
  }

  upring.add('ns:monitoring,cmd:trace', function (req, reply) {
    streams++
    const stream = from.obj(function (n, cb) {
      setTimeout(function () {
        const keys = lru.values()
        lru.reset()
        cb(null, {
          id: upring.me(),
          keys
        })
      }, maxAge)
    })

    upring.on('prerequest', trace)

    eos(stream, function () {
      streams--
      if (streams === 0) {
        upring.removeListener('prerequest', trace)
      }
    })

    reply(null, {
      streams: {
        trace: stream
      }
    })
  })
}


