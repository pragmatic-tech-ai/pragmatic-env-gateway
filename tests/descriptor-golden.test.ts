import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { ReleaseApp } from '@pragmatic-tech-ai/pragmatic-release-toolkit'
import { Components } from '../src/release-components.js'

/**
 * The descriptor this repository's image carries, pinned: its digest (the same pin as the component test) and its
 * canonical bytes (`fixtures/pragmatic-env-gateway.json`). Both move with the declaration and the package version, which
 * the platform release binds.
 */
class DescriptorGoldenFixture
{
    public static readonly PinnedDigest = 'sha256:a3626eeb9e6eb0238a585bc1513b718cfce0216335fcb5bf6a0165997d93257e'
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
    it('has exactly the pinned digest', () =>
    {
        assert.equal(Components.Of(ReleaseApp.EnvGateway).ContentDigest(), DescriptorGoldenFixture.PinnedDigest)
    })

    it('is byte for byte the pinned descriptor', () =>
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
