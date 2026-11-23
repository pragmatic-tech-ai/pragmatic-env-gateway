import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SettingType } from '@pragmatic-tech-ai/pragmatic-component'
import { AppliedConfiguration, ComponentStartConfiguration, type IStartProcess } from '@pragmatic-tech-ai/pragmatic-configuration-runtime'
import { ServerConfigLoader } from '@pragmatic-tech-ai/pragmatic-env-cluster'
import { EnvGatewayComponent } from '../env-gateway-component.js'

class GatewayStart
{
    public static Env(path: string): NodeJS.ProcessEnv
    {
        return {
            PRAGMATIC_CONFIGURATION_FILE: path,
            PRAGMATIC_REDIS_URL: 'redis://env:6379',
            PRAGMATIC_TLS_CERT_FILE: '/c.pem', PRAGMATIC_TLS_KEY_FILE: '/k.pem', PRAGMATIC_TLS_CA_FILE: '/ca.pem',
        }
    }

    public static async InFolder(body: (folder: string) => Promise<void>): Promise<void>
    {
        const folder = await mkdtemp(join(tmpdir(), 'gateway-start-'))
        try
        {
            await body(folder)
        }
        finally
        {
            await rm(folder, { recursive: true, force: true })
        }
    }

    public static async Configuration(folder: string, core: Record<string, unknown>): Promise<string>
    {
        const d = EnvGatewayComponent.Descriptor()
        const path = join(folder, 'configuration.json')
        await writeFile(path, new AppliedConfiguration('acme', d.Name, 1, d.Version, d.ContentDigest(), { options: { core } } as never).ToCanonicalJson())
        return path
    }
}

class ExitRecorder implements IStartProcess
{
    public Code: number | undefined
    public readonly stderr = { write: (): boolean => true }

    public exit(code: number): never
    {
        this.Code = code
        throw new Error('exit')
    }
}

describe('the gateway reads its configuration at start', () =>
{
    it('a mounted configuration overrides the declared variable before the settings are read', async () =>
    {
        await GatewayStart.InFolder(async folder =>
        {
            const env = GatewayStart.Env(await GatewayStart.Configuration(folder, { redisUrl: 'redis://configured:6379', port: 9090 }))
            await ComponentStartConfiguration.Apply({ Declaration: EnvGatewayComponent.Declaration, Env: env, SecretsDir: join(folder, 'run') })
            const gw = ServerConfigLoader.LoadGateway(env)
            assert.deepEqual([gw.redisUrl, gw.port], ['redis://configured:6379', 9090])
        })
    })

    it('no configuration starts as before', async () =>
    {
        const env = GatewayStart.Env('/no/such/configuration.json')
        assert.equal((await ComponentStartConfiguration.ApplyOrExit({ Declaration: EnvGatewayComponent.Declaration, Env: env })).Applied, false)
        assert.equal(ServerConfigLoader.LoadGateway(env).redisUrl, 'redis://env:6379')
    })

    it('an invalid configuration exits with the start error code 78 and the reason', async () =>
    {
        await GatewayStart.InFolder(async folder =>
        {
            const process = new ExitRecorder()
            const env = GatewayStart.Env(await GatewayStart.Configuration(folder, { redisUrl: 'not a url' }))
            await assert.rejects(ComponentStartConfiguration.ApplyOrExit({ Declaration: EnvGatewayComponent.Declaration, Env: env }, process))
            assert.equal(process.Code, 78)
        })
    })

    it('every list setting reads the JSON array encoding', () =>
    {
        const lists = EnvGatewayComponent.Descriptor().Options.flatMap(o => o.Settings).filter(s => s.Type === SettingType.List)
        assert.deepEqual(lists, [], 'the gateway declares no list setting')
    })
})
