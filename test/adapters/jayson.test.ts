import JaysonRPC = require('../../src/adapters/jayson')
import RPC = require('../../src/rpc')
import {expect} from 'chai'
const TestModule = {
    async test(args){
        return 'test'
    },

    async add(args){
        return args[0]+args[1];
    }
}

function createServerClient () : [RPC.BaseServer, RPC.BaseClient]{
    let opt = {
        host: 'localhost',
        port: 22222,
        protocol: 'tcp'
    }
    let server = JaysonRPC.createServer(opt, TestModule)
    let client = JaysonRPC.createClient(opt)
    return [server, client];
}

describe('Jayson JaysonRPC Module', () => {
    describe('#createServer', () => {
        it('creates servers and client', async () => {
            let [server, client] = createServerClient()
            // client.request('test').catch(console.log)
            let res = await client.request('test')
            expect(res.result).to.eq('test')
            res = await client.request('add', [1,2])
            expect(res.result).to.eq(3);
            server.close()
        })
    })

    describe('#expose', () => {
        it('dynamicly defines methods', async() => {
            let [server, client] = createServerClient()
            let res = await client.request('newMethod');
            // console.log(res)
            expect(res.error).to.exist
            server.expose('newMethod', async () => {
                return 'new'
            })
            res = await client.request('newMethod');
            expect(res.result).to.eq('new')
        })
    })
})