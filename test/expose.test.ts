/**
 *
 * Created by caoli on 2017/5/8.
 */
import {boot, getKey} from './helper'
import HighRing, {expose} from "../src/index";
import {assert} from 'chai'


class MyRing extends HighRing{
    @expose()
    async hello(key){
        return `hello ${key}`;
    }
}
describe('Highring#expose', ()=>{
    var ring
    beforeEach(async () => {
        ring = new MyRing()
        return ring.start();
    })
    afterEach(async () => {
        return ring.close()
    })
    it('expose method and define rpc method', async () => {
        let ik = getKey(ring)
        let res = await ring.hello(ik)
        assert.equal(res, 'hello ' + ik)
    })
})