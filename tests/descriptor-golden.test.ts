import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ReleaseApp } from '@pragmatic-tech-ai/pragmatic-release-toolkit'
import { Components } from '../src/release-components.js'

/**
 * The descriptor this repository's image carries is the one pragmatic-server released: the digest pragmatic-server pins
 * (its env-gateway component test and the consoles' vendored `admin/control-plane/descriptors/digests.json`), and the
 * vendored canonical bytes (`fixtures/pragmatic-env-gateway.json`, copied from pragmatic-server@2a2e8138).
 */
class DescriptorGoldenFixture
{
    public static readonly PinnedDigest = 'sha256:027f1f68e9b00164131f0aae8012b1ca6c926f94f6adbae331bf2f0b539e1ebe'
    private static readonly Here = dirname(fileURLToPath(import.meta.url))
    private static readonly Vendored = join(DescriptorGoldenFixture.Here, 'fixtures', 'pragmatic-env-gateway.json')
    private static readonly Manifest = join(DescriptorGoldenFixture.Here, '..', 'package.json')
    private static readonly Utf8 = 'utf8'
    private static readonly Sha256 = 'sha256'
    private static readonly Hex = 'hex'
    private static readonly DigestPrefix = 'sha256:'

    public static VendoredText(): string
    {
        return readFileSync(DescriptorGoldenFixture.Vendored, DescriptorGoldenFixture.Utf8)
    }

    public static DigestOf(text: string): string
    {
        const F = DescriptorGoldenFixture
        return F.DigestPrefix + createHash(F.Sha256).update(text, F.Utf8).digest(F.Hex)
    }

    public static PackageVersion(): string
    {
        const F = DescriptorGoldenFixture
        return (JSON.parse(readFileSync(F.Manifest, F.Utf8)) as { version: string }).version
    }
}

describe('the release descriptor (dist/release-components.js)', () =>
{
    it('has exactly the pragmatic-server golden digest', () =>
    {
        assert.equal(Components.Of(ReleaseApp.EnvGateway).ContentDigest(), DescriptorGoldenFixture.PinnedDigest)
    })

    it('is byte for byte the descriptor pragmatic-server vendored', () =>
    {
        const text = DescriptorGoldenFixture.VendoredText()
        assert.equal(DescriptorGoldenFixture.DigestOf(text), DescriptorGoldenFixture.PinnedDigest)
        assert.equal(Components.Of(ReleaseApp.EnvGateway).ToCanonicalJson(), text)
    })

    it('is the one component of this repository, at the package version', () =>
    {
        const all = Components.All()
        assert.equal(all.length, 1)
        assert.equal(all[0][0], ReleaseApp.EnvGateway)
        assert.equal(all[0][1].Version, DescriptorGoldenFixture.PackageVersion())
    })
})
