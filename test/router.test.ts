import {getKey, bootTwo} from './helper'
import {assert} from 'chai'

process.on('unhandledRejection', (reason, p) => {
    console.log(reason)
    console.log(p)
})

describe('using the request router', () => {
    it('correct respond result', (done) => {
        // this.timeout(5000)
        bootTwo(async (i1, i2, close) => {
            let i1Key = getKey(i1)
            let i2Key = getKey(i2)
            // console.log(i1)
            // console.log(i2)

            i1.exposeMethod('parse', async (args) => {
                // assert.equal(req.key, i1Key, 'key matches')this._hashring.close();
                assert.equal(args[0], 42, 'other key matches')
                return {replying: 'i1'}
            })

            i2.exposeMethod('parse', async (args) => {
                // assert.equal(req.key, i2Key, 'key matches')
                assert.equal(args[0], 42, 'other key matches')
                return {replying: 'i2'}
            })
            // let res = await i1.request(i2Key, 'parse', [42])
            let res = await i1.request(i2Key, 'parse', [42])
            assert.deepEqual(res, {
                replying: 'i2'
            }, 'response matches')

            res = await i2.request(i1Key, 'parse', [42])

            assert.deepEqual(res, {
                replying: 'i1'
            }, 'response matches')
            close().then(() => done());
        })
    })

    it('use the sugar notation for pattern', (done) => {

        bootTwo(async (i1, i2, close) => {
            let i1Key = getKey(i1)

            i1.exposeMethod('sugar', async (args) => {
                assert.equal(args[0], 1)
                assert.equal(args[1], i1Key)
                console.log(args)
                return {replying: 'i1', args}
            })

            let res = await i2.request(i1Key, 'sugar', [1])

            assert.deepEqual(res, {
                replying: 'i1',
                args: [1, i1Key]
            }, 'response matches')

            await close()
            done();
        })
    })

    it('use tinysonic for pattern', (t) => {

        bootTwo((i1, i2) => {
            let i1Key = getKey(i1)

            i1.add('cmd:sugar', (req, reply) => {
                assert.equal(req.key, i1Key, 'Match made')
                assert.equal(req.value, 1, 'Value matches')
                reply(null, {replying: 'i1'})
            })

            i2.request({
                key: i1Key,
                cmd: 'sugar',
                value: 1
            }, (err, response) => {
                assert.fail(err, 'NO ERROR')
                assert.deepEqual(response, {
                    replying: 'i1'
                }, 'response matches')
            })
        })
    })

    it('not found', (t) => {

        bootTwo((i1, i2) => {
            let i2Key = getKey(i2)

            i1.request({
                key: i2Key,
                cmd: 'another',
                value: 42
            }, (err, response) => {
                assert.ok(err)
                assert.equal(err.message, 'message does not match any pattern')
                assert.notOk(response, 'no response')
            })

            i2.add({cmd: 'parse'}, (req, reply) => {
                assert.fail('this should never happen')
                reply(null, {replying: 'i2'})
            })
        })
    })
})


