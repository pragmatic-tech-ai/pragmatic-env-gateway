import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EnvGatewayComponent } from '../env-gateway-component.js'
import { ComponentGolden } from '../../component/tests/component-golden.js'
import { ComponentSources } from '../../component/tests/component-sources.js'

class EnvGatewayComponentFixture
{
    public static readonly Here = dirname(fileURLToPath(import.meta.url))
    public static readonly Golden = join(EnvGatewayComponentFixture.Here, 'fixtures', 'pragmatic-env-gateway.component.json')
    public static readonly Digest = 'sha256:a3626eeb9e6eb0238a585bc1513b718cfce0216335fcb5bf6a0165997d93257e'
    public static readonly Readers = [ComponentSources.InPackage('@pragmatic-tech-ai/pragmatic-env-cluster', 'config', 'server-config-loader.js')]
    /** Platform-owned: what the gateway reads but no tenant configuration may set (the descriptor leaves them out), by reason. */
    public static readonly PlatformOwned: Readonly<Record<string, readonly string[]>> = {
        'its listener and health listener (the Service and probes are rendered against them)': ['PRAGMATIC_HOST', 'PRAGMATIC_PORT', 'PRAGMATIC_HEALTH_PORT', 'PRAGMATIC_METRICS_PORT'],
        'the worker directory and workers of its own environment': ['PRAGMATIC_REDIS_URL', 'PRAGMATIC_WORKER_SERVERNAME'],
        'its TLS and client-TLS material (mounted files)': [
            'PRAGMATIC_TLS_CERT_FILE', 'PRAGMATIC_TLS_KEY_FILE', 'PRAGMATIC_TLS_CA_FILE', 'PRAGMATIC_CLIENT_TLS_CERT_FILE', 'PRAGMATIC_CLIENT_TLS_KEY_FILE', 'PRAGMATIC_CLIENT_TLS_CA_FILE',
        ],
        'where its audit records go (the deployment volume)': ['PRAGMATIC_AUDIT_SINK', 'PRAGMATIC_AUDIT_FILE'],
    }
}

describe('EnvGatewayComponent', () =>
{
    it('pins the descriptor: golden JSON and content digest', () =>
    {
        ComponentGolden.Check(EnvGatewayComponent.Descriptor(), EnvGatewayComponentFixture.Golden, EnvGatewayComponentFixture.Digest)
    })

    it('declares only variables ServerConfigLoader reads (LoadGateway reads a subset of them)', () =>
    {
        ComponentSources.AssertDeclaredRead(EnvGatewayComponent.Descriptor(), EnvGatewayComponentFixture.Readers)
    })

    it('declares none of its wiring: listener, worker directory, TLS material, metrics port, audit sink (one configuration is applied to every environment)', () =>
    {
        const declared = ComponentSources.Declared(EnvGatewayComponent.Descriptor())
        const read = ComponentSources.ReadBy(EnvGatewayComponentFixture.Readers)
        for (const [reason, variables] of Object.entries(EnvGatewayComponentFixture.PlatformOwned))
        {
            assert.deepEqual(variables.filter(v => declared.includes(v)), [], reason)
            assert.deepEqual(variables.filter(v => !read.includes(v)), [], 'read by the loader: ' + reason)
        }
        assert.deepEqual(EnvGatewayComponent.Descriptor().Options.flatMap(o => o.Settings).filter(s => s.Required).map(s => s.Name), [], 'nothing required: the deployment injects the wiring')
    })

    it('is named for its release image', () =>
    {
        assert.equal(EnvGatewayComponent.Descriptor().Name, 'pragmatic-env-gateway')
    })
})
