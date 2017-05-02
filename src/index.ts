/// <reference path="../typings/swim-hashring.d.ts" />
/// <reference path="../typings/swim.d.ts" />

import HashRing = require('swim-hashring')
import networkAddress = require('network-address')
import Promise = require('bluebird')
Promise.config({
    // Enable warnings
    warnings: true,
    // Enable long stack traces
    longStackTraces: true,
    // Enable cancellation
    cancellation: true,
    // Enable monitoring
    monitoring: true
});
const pino = require('pino')
const serializers = require('./serializers')
import Replicator from './replicator'
import monitoring from './monitoring';
import {BaseClient, RPCModule, ServerFactory} from './rpc';
import {isFunction, isString} from "util";
import {merge} from 'lodash'
import DefaultAdapter = require('./adapters/jayson')

const defaultOptions = {
    host: networkAddress(),
    port: 0,
    local: {
        hashring: {
            meta: {
                upring: {

                }
            }
        }
    },
    logger: pino({ serializers }),
    rpc: DefaultAdapter
}

type PeerID = string;

function sleep(timeout:number):Promise<void>{
    return Promise.fromCallback(cb => setTimeout(cb, timeout))
}

function makeOption(options){
    options = merge(defaultOptions, options)
    const hashringOpts = options.hashring || {}
    hashringOpts.base = hashringOpts.base || options.base
    hashringOpts.name = hashringOpts.name || options.name
    hashringOpts.client = hashringOpts.client || options.client
    hashringOpts.host = options.host
    const local = hashringOpts.local = hashringOpts.local || {}
    const meta = local.meta = local.meta || {}
    meta.upring = {
        address: options.host,
        port: 23333 + Math.floor(Math.random() * 10)//options.port
    }
    console.log(hashringOpts)
    console.log(meta)

    return hashringOpts
}

export default class UpRing extends HashRing {
    protected ready: boolean = false;
    protected logger
    protected closed: boolean = false;


    private _router
    private _server
    private _peerConn: { [key: string]: BaseClient } = {}
    private _tracker

    private rpc: RPCModule;
    private _initRpcModule(module:string | RPCModule){
        if(isString(module)){
            module = require(module);
        }
        module = <RPCModule>module;

        if(!(isFunction(module.createServer) &&
            isFunction(module.createClient) &&
            isFunction(module.Client) &&
            isFunction(module.Server))){
            throw new TypeError('specific module has missing exports, does not satisify interface')
        }
        this.rpc = module
    }
    constructor(options) {
        super(makeOption(options))
        options = Object.assign(defaultOptions, options)
        this._initRpcModule(options.rpc)

        this.logger = options.logger ? options.logger.child({ serializers }) : pino({ serializers })

        this.on('up', () => {
            this.ready = true
            this.logger = this.logger.child({ id: this.whoami() }) // TODO
            // this.logger.info({ address: this._server.address() }, 'node up')
        })

        this.on('steal', (info) => {
            this.logger.trace(info, 'steal')
        })

        this.on('move', (info) => {
            this.logger.trace(info, 'move')
        })

        this.rpc.createServer(options).then(server => {
            this._server = server;
        })
    }

    join(peers: string[] | string) {
        if (!Array.isArray(peers)) {
            peers = [peers]
        }
        return Promise.fromCallback(cb => this.swim.join(peers, cb))
    }

    async peerConn(peer) {
        let conn = this._peerConn[peer.id]

        if (!conn) {
            this.logger.debug({ peer: peer }, 'connecting to peer')
            conn = await this.setupConn(peer)
            this._peerConn[peer.id] = conn;
        }

        return conn
    }

    exposeMethod(name, func) {
        this._server.expose(name, func)
    }

    async request(target, method, args, _count=0) {
        if (this.allocatedToMe(target)) {
            this.logger.trace({ method, args }, 'local call')
            return this._server.call(method, args);
        } else {
            let peer = this.lookup(target);
            this.logger.trace({ method, args, peer }, 'remote call')

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

            const conn = await this.peerConn(peer);

            if (conn.destroyed) {
                while(_count < 3) {

                }
                await sleep(500)

                return this.request(target, method, args, _count)
            }

            return conn.request(method, args)
        }
    }

    close(): PromiseLike<any> {
        if (this.closed) {
            return Promise.resolve();
        }

        if (this._tracker) {
            this._tracker.clear()
        }

        this.closed = true

        Object.keys(this._peerConn).forEach((id) => {
            this._peerConn[id].destroy()
        })

        // const p = Promise.promisify(super.close, { context: this });
        super.close()
        return new Promise((resolve, reject) => {
            this._server.close((err) => {
                this.logger.info('closed')
                this.emit('close')
                if (err) {
                    return reject(err)
                }
                return resolve()
            })
        })
    }

    private async setupConn(peer): Promise<BaseClient> {
        console.log(peer)
        let c = await this.rpc.createClient({
            host: peer.meta.upring.address,
            port: peer.meta.upring.port
        });
        this._peerConn[peer.id] = c;
        return c;
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