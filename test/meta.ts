
import {boot} from './helper'
import {assert} from 'chai'
describe('meta', () => {
  it('aaa', (done) => {
    boot((one, closeOne) => {
      boot(async (two, closeTwo) => {
        assert.deepEqual(one.peers(), [], 'no peers')
        assert.deepEqual(one.peers(true), [one.myMeta()], 'includes myself')

        one.on('peerUp', function (peer) {
          assert.equal(peer.id, two.me(), 'peer id matches')
          assert.deepEqual(one.peers(), [peer], 'one peer')
          assert.deepEqual(one.peers(true), [peer, one.myMeta()], 'two peers including myself')
          two.close()
        })

        one.on('peerDown', function (peer) {
          assert.equal(peer.id, two.me(), 'peer id matches')
          closeOne()
          done();
        })

        // let's join them in a cluster
        await one.join([two.me()]);
      })
    })
  })
})

// boot two unrelated instance

