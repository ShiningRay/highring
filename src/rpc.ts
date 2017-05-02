export interface RPCModule {
    createClient: ClientFactory;
    createServer: ServerFactory;
    Server: ServerConstructor;
    Client: ClientConstructor;
}


export interface BaseServer {
    /**
     * add a method to rpc server
     * @param name
     * @param func
     */
    expose(name, func)
    /**
     * direct call method for local request
     * @param name
     * @param args
     */
    call(name:string, args:any[]):Promise<any>;
    close();
}

export interface BaseClient {
    destroy();
    destroyed:boolean;
    request(method, args?):Promise<any>;
}

export type ServerConstructor = new() => BaseServer;
export type ServerFactory = (options, module?) => Promise<BaseServer>;
export type ClientConstructor = new() => BaseClient;
export type ClientFactory = (peer) => Promise<BaseClient>;
