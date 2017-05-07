
import upring from '../src/index'

// returns a key allocated to the passed instance
export function getKey (instance) {
    let key = 'hello'

    while (!instance.allocatedToMe(key)) {
        key += '1'
    }

    return key
}

export function opts (opts) {
    opts = opts || {}
    opts.hashring = opts.hashring || {}
    opts.hashring.joinTimeout = 200
    opts.hashring.replicaPoints = 10
    return opts
}


// boot one instance
export function boot (parent, cb?) {
    if (typeof parent === 'function') {
        cb = parent
        parent = null
    }

    const base = []

    if (parent) {
        base.push(parent.me())
    }

    const instance = new upring(opts({
        logLevel: 'error',
        base: base
    }))

    let done = instance.close.bind(instance)

    instance.on('up', () => {
        cb(instance, done)
    })
    return instance.start();
}


// boot two instances
export function bootTwo (cb) {
    return boot((i1, done1) => {
        console.log('i1 up')
        return boot(i1, (i2, done2) => {
            console.log('i2 up')
            cb(i1, i2, () => Promise.all([done1(), done2()]) )
        })
    })
}

