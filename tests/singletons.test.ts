import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

/**
 * Every installed copy of a package, found by walking node_modules (nested ones included) for package.json names. The
 * engine packages hold classes other packages check with `instanceof`, so a second copy breaks them across the copies.
 */
class InstalledPackages
{
    private static readonly NodeModules = 'node_modules'
    private static readonly PackageJson = 'package.json'
    private static readonly ScopePrefix = '@'
    private static readonly Utf8 = 'utf8'

    private readonly names = new Map<string, string[]>()

    public constructor(root: string)
    {
        this.Walk(join(root, InstalledPackages.NodeModules))
    }

    public CopiesOf(name: string): string[]
    {
        return this.names.get(name) ?? []
    }

    private Walk(modules: string): void
    {
        if (!existsSync(modules))
        {
            return
        }
        for (const entry of readdirSync(modules, { withFileTypes: true }))
        {
            if (!entry.isDirectory() && !entry.isSymbolicLink())
            {
                continue
            }
            const path = join(modules, entry.name)
            if (entry.name.startsWith(InstalledPackages.ScopePrefix))
            {
                this.Walk(path)
                continue
            }
            this.Record(path)
            this.Walk(join(path, InstalledPackages.NodeModules))
        }
    }

    private Record(dir: string): void
    {
        const manifest = join(dir, InstalledPackages.PackageJson)
        if (!existsSync(manifest))
        {
            return
        }
        const name = (JSON.parse(readFileSync(manifest, InstalledPackages.Utf8)) as { name?: string }).name
        if (name !== undefined)
        {
            this.names.set(name, [...this.CopiesOf(name), dir])
        }
    }
}

class SingletonsFixture
{
    public static readonly Root = join(dirname(fileURLToPath(import.meta.url)), '..')
    /** Reached by the gateway's closure (pragmatic-env-cluster → pragmatic-identity). */
    public static readonly TodlRuntime = '@pragmatic-tech-ai/todl-runtime'
    /** Not reached today; never more than one if a dependency starts to bring them. */
    public static readonly Todl = '@pragmatic-tech-ai/todl'
    public static readonly Mural = '@pragmatic-tech-ai/mural'
}

describe('engine singletons', () =>
{
    const installed = new InstalledPackages(SingletonsFixture.Root)

    it('installs exactly one copy of todl-runtime', () =>
    {
        assert.equal(installed.CopiesOf(SingletonsFixture.TodlRuntime).length, 1, installed.CopiesOf(SingletonsFixture.TodlRuntime).join(', '))
    })

    it('installs at most one copy of todl and of mural', () =>
    {
        for (const name of [SingletonsFixture.Todl, SingletonsFixture.Mural])
        {
            assert.ok(installed.CopiesOf(name).length <= 1, name + ': ' + installed.CopiesOf(name).join(', '))
        }
    })
})
