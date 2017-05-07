/// <reference path="../typings/swim-hashring.d.ts" />
/// <reference path="../typings/swim.d.ts" />

import HashRing = require('swim-hashring')
import networkAddress = require('network-address')
import Bluebird = require('bluebird')
const pino = require('pino')
const serializers = require('./serializers')
import Replicator from './replicator'
import monitoring from './monitoring';
import {BaseClient, RPCModule, ServerFactory} from './rpc';
import {isFunction, isString, isUndefined} from "util";
import {merge} from 'lodash'
import DefaultAdapter = require('./adapters/jayson')
import {EventEmitter} from 'events' ;

const defaultOptions = {
    host: networkAddress(),
    port: 0,
    hashring: {
        local: {
            meta: {
                upring: {
                    port: 0
                }
            }

        },
    },
    logger: pino({serializers}),
    rpc: DefaultAdapter
}

type PeerID = string;

function makeOption(options) {

}

export default class HighRing extends EventEmitter {
    protected ready: boolean = false;
    protected logger
    protected closed: boolean = false;
    private swim;
    private _router
    private _server
    private _peerClients: { [key: string]: BaseClient } = {}
    private _tracker
    private _hashring: HashRing;
    private rpc: RPCModule;

    private _initRpcModule(module: string | RPCModule) {
        if (isString(module)) {
            module = require(module);
        }
        module = <RPCModule>module;

        if (!(isFunction(module.createServer) &&
            isFunction(module.createClient) &&
            isFunction(module.Client) &&
            isFunction(module.Server))) {
            throw new TypeError('specific module has missing exports, does not satisify interface')
        }
        this.rpc = module
    }

    constructor(private options) {
        super()
        // this.options = options
        options = merge(options, defaultOptions)
        const hashringOpts = options.hashring
        hashringOpts.base = hashringOpts.base || options.base
        hashringOpts.name = hashringOpts.name || options.name
        hashringOpts.client = hashringOpts.client || options.client
        hashringOpts.host = options.host
        const local = hashringOpts.local
        const meta = local.meta
        meta.upring.address = options.host
        options.hashring = hashringOpts;
        this._initRpcModule(options.rpc)
        this.logger = options.logger ? options.logger.child({serializers}) : pino({serializers})
    }

    async start() {
        this._server = await this.rpc.createServer({
            host: this.options.host,
            port: this.options.port
        });
        this.options.hashring.local.meta.upring = this._server.address()
        this._hashring = new HashRing(this.options.hashring);
        this._hashring.setMaxListeners(0)
        this._hashring.on('up', () => {
            this.ready = true
            this.logger = this.logger.child({id: this.me()}) // TODO
            // this.logger.info({ address: this._server.address() }, 'node up')
            this.emit('up')
        })

        this._hashring.on('steal', (info) => {
            this.logger.trace(info, 'steal')
            this.emit('steal', info)
        })

        this._hashring.on('move', (info) => {
            this.logger.trace(info, 'move')
            this.emit('move', info)
        })
        this._hashring.on('error', this.emit.bind(this, 'error'))
        this._hashring.on('peerUp', this.emit.bind(this, 'peerUp'))
        this._hashring.on('peerDown', this.emit.bind(this, 'peerDown'))
    }

    me() {
        return this._hashring.whoami();
    }

    allocatedToMe(key: string) {
        return this._hashring.allocatedToMe(key);
    }

    myMeta() {
        return this._hashring.mymeta();
    }

    lookup(key) {
        return this._hashring.lookup(key)
    }

    join(peers: string[] | string) {
        if (!Array.isArray(peers)) {
            peers = [peers]
        }
        return Bluebird.fromCallback(cb => this.swim.join(peers, cb))
    }

    async clientToPeer(peer) {
        let conn = this._peerClients[peer.id]

        if (isUndefined(conn)) {
            this.logger.debug({peer: peer}, 'connecting to peer')
            conn = await this.rpc.createClient({
                host: peer.meta.upring.address,
                port: peer.meta.upring.port
            });
            this._peerClients[peer.id] = conn;
        }

        return conn
    }

    exposeMethod(name, func) {
        this._server.expose(name, func)
    }

    async request(target, method, args = [], kwArgs = {}, _count = 0) {
        this.emit('beforeRequest', target, method, args, kwArgs)
        if (this.allocatedToMe(target)) {
            this.logger.trace({method, args}, 'local call')
            return this._server.call(target, method, args, kwArgs);
        } else {
            let peer = this.lookup(target);
            this.logger.trace({method, args, peer}, 'remote call')

            let upring = peer.meta.upring

            if (!upring || !upring.address || !upring.port) {
                throw new Error('peer has invalid upring metadata')
            }

            // and avoid allocating a closure
            if (typeof _count !== 'number') {
                _count = 0
            } else if (_count >= 3) {
                throw new Error('retried three times')
            } else {
                _count++
            }

            const conn = await this.clientToPeer(peer);

            if (conn.destroyed) {
                while (_count < 3) {

                }
                // await sleep(500)

                return this.request(target, method, args, kwArgs, _count)
            }

            return conn.request(target, method, args, kwArgs)
        }
    }

    async close() {
        if (this.closed) {
            return Promise.resolve();
        }

        this.closed = true

        Object.keys(this._peerClients).forEach((id) => {
            this._peerClients[id].destroy()
            delete this._peerClients[id]
        })
        // const p = Promise.promisify(super.close, { context: this });
        this._hashring.close();
        await this._server.close()
        this.logger.info('closed')
        this.emit('close')
    }

    // private _dispatch(req, reply) {
    //     if (!this.ready) {
    //         this.on('up', this._dispatch.bind(this, req, reply))
    //         return
    //     }
    //
    //     var func
    //     this.emit('prerequest', req)
    //     if (this._router) {
    //         func = this._router.lookup(req)
    //         if (func) {
    //             func(req, reply)
    //         } else {
    //             reply(new Error('message does not match any pattern'))
    //         }
    //     } else {
    //         this.emit('request', req, reply)
    //     }
    // }

    private startServer() {

    }


    /*toString(){

     }*/
}

export function expose(opt: any = {}) {
    opt = Object.assign({bind: true}, opt)
    return function (target: any, propertyKey: string) {
        let func = target[propertyKey];
        let name = propertyKey;
        if (opt.bind) {
            func = func.bind(target)
        }
        if (opt.alias !== undefined) {
            name = opt.alias
        }
        target._server.expose(name, func)
    }
}