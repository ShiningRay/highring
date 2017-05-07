"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../src/index");
// returns a key allocated to the passed instance
function getKey(instance) {
    let key = 'hello';
    while (!instance.allocatedToMe(key)) {
        key += '1';
    }
    return key;
}
exports.getKey = getKey;
function opts(opts) {
    opts = opts || {};
    opts.hashring = opts.hashring || {};
    opts.hashring.joinTimeout = 200;
    opts.hashring.replicaPoints = 10;
    return opts;
}
exports.opts = opts;
// boot one instance
function boot(parent, cb) {
    if (typeof parent === 'function') {
        cb = parent;
        parent = null;
    }
    const base = [];
    if (parent) {
        base.push(parent.me());
    }
    const instance = new index_1.default(opts({
        logLevel: 'error',
        base: base
    }));
    let done = instance.close.bind(instance);
    instance.on('up', () => {
        cb(instance, done);
    });
    return instance.start();
}
exports.boot = boot;
// boot two instances
function bootTwo(cb) {
    return boot((i1, done1) => {
        console.log('i1 up');
        return boot(i1, (i2, done2) => {
            console.log('i2 up');
            cb(i1, i2, () => Promise.all([done1(), done2()]));
        });
    });
}
exports.bootTwo = bootTwo;
//# sourceMappingURL=helper.js.map