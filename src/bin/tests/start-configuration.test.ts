import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SettingType } from '@pragmatic-tech-ai/pragmatic-component'
import { AppliedConfiguration, AppliedConfigurationEntries, ComponentStartConfiguration, type IStartProcess } from '@pragmatic-tech-ai/pragmatic-configuration-runtime'
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
            const env = GatewayStart.Env(await GatewayStart.Configuration(folder, { drainTimeoutMs: 5000 }))
            await ComponentStartConfiguration.Apply({ Declaration: EnvGatewayComponent.Declaration, Env: env, SecretsDir: join(folder, 'run') })
            const gw = ServerConfigLoader.LoadGateway(env)
            assert.equal(gw.drainTimeoutMs, 5000)
            assert.equal(gw.redisUrl, 'redis://env:6379', 'the worker directory stays the deployment own')
        })
    })

    it('a configuration that names its wiring (an earlier version declared it) is refused (78), never overlaid', async () =>
    {
        await GatewayStart.InFolder(async folder =>
        {
            const process = new ExitRecorder()
            const env = GatewayStart.Env(await GatewayStart.Configuration(folder, { redisUrl: 'redis://configured:6379' }))
            await assert.rejects(ComponentStartConfiguration.ApplyOrExit({ Declaration: EnvGatewayComponent.Declaration, Env: env }, process))
            assert.equal(process.Code, 78)
            assert.equal(env.PRAGMATIC_REDIS_URL, 'redis://env:6379')
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
            const env = GatewayStart.Env(await GatewayStart.Configuration(folder, { drainTimeoutMs: 'not-a-number' }))
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

describe('the gateway after a release changed its descriptor (I1)', () =>
{
    it('reads the entry prepared for its own descriptor beside a configuration applied for the previous one', async () =>
    {
        await GatewayStart.InFolder(async folder =>
        {
            const own = EnvGatewayComponent.Descriptor()
            const path = join(folder, 'configuration.json')
            await writeFile(path, new AppliedConfiguration('acme', own.Name, 1, '0.1.1', `sha256:${'1'.repeat(64)}`, { options: { core: { drainTimeoutMs: 1000 } } } as never).ToCanonicalJson())
            const entry = new AppliedConfiguration('acme', own.Name, 2, own.Version, own.ContentDigest(), { options: { core: { drainTimeoutMs: 7000 } } } as never)
            await writeFile(join(folder, AppliedConfigurationEntries.KeyOf(entry.DescriptorDigest)), entry.ToCanonicalJson())
            const env = GatewayStart.Env(path)
            const process = new ExitRecorder()
            assert.equal((await ComponentStartConfiguration.ApplyOrExit({ Declaration: EnvGatewayComponent.Declaration, Env: env }, process)).Applied, true)
            assert.equal(process.Code, undefined)
            assert.equal(ServerConfigLoader.LoadGateway(env).drainTimeoutMs, 7000, 'the prepared entry, not the file of the old descriptor')
        })
    })
})
