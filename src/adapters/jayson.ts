import Bluebird = require('bluebird')
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
        console.log('create server', options)
        options.protocol = options.protocol || 'tcp'
        this.server = server(module)
        this.module = module
        this.netServer = this.server[options.protocol].call(this.server)
        this.netServer.listen(options, (err) => {
            cb(err, this)
        })
    }

    expose(name, func) {
        return this.server.method(name, (args) => func(...args));
    }

    async call(key, name, args){
        args.push(key);
        return Bluebird.fromCallback(cb => this.server.getMethod(name).execute(this.server,args,cb))
        // return this.server.getMethod(name).execute(this.server,args)
    }

    close() {
        return Bluebird.fromCallback(cb => this.netServer.close(cb));
    }

    address(){
        return this.netServer.address();
    }
}

export class Client implements BaseClient {
    private _destroyed = false
    private client: client;

    constructor(option: Options) {
        console.log('create client', option)
        option.protocol = option.protocol || 'tcp'
        this.client = client[option.protocol](option)
    }

    async request(key, method, args: any[] = []) {
        args.unshift(key);
        if(!this._destroyed){
            let res = await this.client.request(method, args)
            console.log(res)
            return res.result;
        }
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
    return Bluebird.fromCallback(cb => new Server(options, module, cb))
}