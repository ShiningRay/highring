/**
 *
 * Created by caoli on 2017/5/7.
 */
import Highring, {expose} from '../src/index'
import Bluebird = require('bluebird')
global.Promise = Bluebird
Bluebird.config({
    longStackTraces: true
})
process.on('unhandledRejection', console.log)
import {times} from 'lodash'

class KV extends Highring {
    private store: any = {}

    @expose()
    async get(key: string) {
        this.logger.info(this.me(), 'get:', key)
        return this.store[key]
    }

    @expose()
    async put(key, value) {
        // this.logger.info(this.me(), 'put:', key, value)
        let orig = this.store[key]
        this.store[key] = value;

        return orig
    }
}
var base = new KV();
if (!module.parent) {

    (async () => {

        await base.start();
        console.log('base:', base.me())
        let instances = times(5, () => new KV({base: base.me()}))
        await Promise.all(instances.map(i => i.start()));
        console.log(instances.map((i, j) => `${j} : ${i}`));
        console.log('base: ', base.toString())
        console.log("hello ->", base.lookup('hello').id)
        let conn = await base.clientToKey('hello')
        await base.put('hello', 'world')
        console.log(await instances[0].get('hello'))
    })()
}