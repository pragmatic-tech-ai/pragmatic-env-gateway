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
    public static readonly Digest = 'sha256:0f481208b106ecab05634c384ea395c792686feb306d636c3dd4a16ccf54f5ea'
    public static readonly Readers = [ComponentSources.InPackage('@pragmatic-tech-ai/pragmatic-env-cluster', 'config', 'server-config-loader.js')]
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

    it('is named for its release image', () =>
    {
        assert.equal(EnvGatewayComponent.Descriptor().Name, 'pragmatic-env-gateway')
    })
})
