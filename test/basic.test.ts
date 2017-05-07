
import fs = require('fs')
import path = require('path')
import {assert} from 'chai'
import upring from '../src/index'
const packageFile = path.join(__dirname, '..', 'package.json')
const maxInt = Math.pow(2, 32) - 1

import {getKey, bootTwo, opts} from './helper'
describe('Basic cases', () => {
    it('request to two nodes',  (done) => {
        bootTwo((i1, i2, end) => {
            let i1Key = getKey(i1)
            let i2Key = getKey(i2)

            i1.request({
                key: i2Key,
                hello: 42
            }, (err, response) => {
                assert.isUndefined(err)
                assert.deepEqual(response, {
                    replying: 'i2'
                }, 'response matches')
            })

            i2.request({
                key: i1Key,
                hello: 42
            }, (err, response) => {
                assert.isUndefined(err)
                assert.deepEqual(response, {
                    replying: 'i1'
                }, 'response matches')
            })

            i1.on('request', (req, reply) => {
                assert.equal(req.key, i1Key, 'key matches')
                assert.equal(req.hello, 42, 'other key matches')
                reply(null, {replying: 'i1'})
            })

            i2.on('request', (req, reply) => {
                assert.equal(req.key, i2Key, 'key matches')
                assert.equal(req.hello, 42, 'other key matches')
                reply(null, {replying: 'i2'})
            })

            end().then(() => done())
        })
    })

    test('streams!',  () => {

        bootTwo((i1, i2) => {
            let i2Key = getKey(i2)

            i1.request({
                key: i2Key,
                hello: 42
            }, (err, response) => {
                assert.fail(err)
                assert.equal(response.replying, 'i2', 'response matches')
                response.streams.p
                    .pipe(concat((list) => {
                        assert.equal(list.toString(), fs.readFileSync(packageFile).toString())
                    }))
            })

            i2.on('request', (req, reply) => {
                assert.equal(req.key, i2Key, 'key matches')
                assert.equal(req.hello, 42, 'other key matches')
                let stream = fs.createReadStream(packageFile)
                reply(null, {
                    replying: 'i2',
                    streams: {
                        p: stream
                    }
                })
            })
        })
    })

    test('streams with error',  () => {

        bootTwo((i1, i2) => {
            let i2Key = getKey(i2)

            i1.request({
                key: i2Key,
                hello: 42
            }, (err, response) => {
                assert.fail(err)
                assert.equal(response.replying, 'i2', 'response matches')
                response.streams.p
                    .on('error', () => {
                        assert.ok('error happened')
                    })
                    .pipe(concat((list) => {
                        assert.fail('stream should never end')
                    }))
            })

            i2.on('request', (req, reply) => {
                assert.equal(req.key, i2Key, 'key matches')
                assert.equal(req.hello, 42, 'other key matches')
                let stream = fs.createReadStream('path/to/nowhere')
                reply(null, {
                    replying: 'i2',
                    streams: {
                        p: stream
                    }
                })
            })
        })
    })

    test('client',  () => {

        bootTwo((i1, i2) => {
            const client = upring(opts({
                client: true,
                logLevel: 'error',
                base: [i1.me(), i2.me()]
            }))

            assert.tearDown(client.close.bind(client))

            client.on('up', () => {
                assert.ok('client up')

                for (var i = 0; i < maxInt; i += 1000) {
                    if (client.allocatedToMe(i)) {
                        assert.fail('nothing should be allocated to a client')
                        return
                    }
                }

                client.request({
                    key: 'hello'
                }, (err, res) => {
                    assert.fail(err)
                    assert.equal(res.hello, 'world')
                    assert.notEqual(res.from, client.me())
                })
            })

            i1.on('request', handle)
            i2.on('request', handle)
            client.on('request', handle)

            function handle(req, reply) {
                reply(null, {hello: 'world', from: this.me()})
            }
        })
    })

    test('request to node 2',  () => {
        bootTwo((i1, i2) => {
            assert.equal(i1.peers().length, 1, 'there is only one other peer')
            assert.equal(i1.peers()[0].id, i2.mymeta().id, 'the other peer is i2')

            i1.on('request', (req, reply) => {
                assert.fail('no request should happen to i1')
                reply(new Error('no request should happen to i1'))
            })

            i2.on('request', (req, reply) => {
                assert.ok('request to i2')
                assert.deepEqual(req, {hello: 'world'}, 'correct message')
                reply(null, {a: 'response'})
            })

            i1.clientToPeer(i1.peers()[0]).request({
                hello: 'world'
            }, (err, res) => {
                assert.fail(err)
                assert.deepEqual(res, {a: 'response'})
            })
        })
    })
})

