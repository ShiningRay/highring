import Promise = require('bluebird')
import {server, client} from 'jayson/promise'
import {BaseClient, BaseServer} from "../rpc";

interface Options {
    host: string;
    port: number;
    protocol?: string;
}

export class Server implements BaseServer {
    private server;
    private module;
    private netServer;

    constructor(private options: Options, module: any, cb?) {
        options.protocol = options.protocol || 'tcp'
        this.server = server(module)
        this.module = module
        this.netServer = this.server[options.protocol].call(this.server)
        this.netServer.listen(options, (err) => {
            cb(err, this)
        })
    }

    expose(name, func) {
        return this.server.method(name, func);
    }

    async call(name, args){
        return this.module[name].apply(null,args)
    }

    close() {
        return Promise.fromCallback(cb => this.netServer.close(cb));
    }
}

export class Client implements BaseClient {
    private _destroyed = false
    private client: client;

    constructor(option: Options) {
        option.protocol = option.protocol || 'tcp'
        this.client = client[option.protocol](option)
    }

    async request(method, args: any[] = []) {
        if(!this._destroyed)
            return this.client.request(method, args)
        else
            throw new Error('client is destroyed')
    }

    /**
     * because jayson uses short connection on each request.
     */
    destroy() {
        this._destroyed = true;
    }

    get destroyed() {
        return this._destroyed;
    }
}

export function createClient(options: Options) {
    return Promise.resolve(new Client(options));
}

export function createServer(options: Options, module) {
    return Promise.fromCallback(cb => new Server(options, module, cb))
}