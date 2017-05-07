
export interface RPCModule {
    createClient: ClientFactory;
    createServer: ServerFactory;
    Server: ServerConstructor;
    Client: ClientConstructor;
}

interface Address {
    address: string;
    port: number;
    addressType?: number | "udp4" | "udp6";
    family?: 'IPv4' | 'IPv6';
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
    call(key: string, name:string, args:any[], kwArgs?:{[key:string]:any}):Promise<any>;
    address():Address;
    close();
}

export interface BaseClient {
    destroy();
    destroyed:boolean;
    request(key: string, method, kwArgs?:{[key:string]:any}):Promise<any>;
    request(key: string, method, args?, kwArgs?:{[key:string]:any}):Promise<any>;
}

export type ServerConstructor = new() => BaseServer;
export type ServerFactory = (options, module?) => Promise<BaseServer>;
export type ClientConstructor = new() => BaseClient;
export type ClientFactory = (peer) => Promise<BaseClient>;
