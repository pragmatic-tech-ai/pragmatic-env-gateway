import { SettingType, type ComponentDescriptor, ComponentDeclarations, type ComponentDeclaration } from '@pragmatic-tech-ai/pragmatic-component'
import { ServerOptionDeclarations } from '@pragmatic-tech-ai/pragmatic-env-cluster'

/**
 * The component descriptor of the env gateway image (pragmatic-gatewayd): what `ServerConfigLoader.LoadGateway` reads and a
 * tenant may tune. A router in front of the workers: no database of its own.
 *
 * What binds the gateway to the environment it is deployed into is the platform's, injected by the manifests and left out
 * of the descriptor, so no configuration (one per realm, applied to every environment) can set it (C3.1 Ledger,
 * platform-owned settings): its listener and health listener (the Service and probes are rendered against them), the Redis
 * worker directory and the workers' TLS name of its own environment, its TLS and client-TLS material (mounted files), the
 * metrics port, and where its audit records go (the deployment's volume).
 */
export class EnvGatewayComponent
{
    public static readonly Name = 'pragmatic-env-gateway'
    /** The descriptor version: this application's package version (the release test pins it to package.json). */
    public static readonly Version = '0.1.2'
    private static readonly MetricsPort = 'metricsPort'

    /** The declaration: the descriptor, and the variable the start step overlays each configured setting onto. */
    public static readonly Declaration: ComponentDeclaration = {
        name: EnvGatewayComponent.Name,
        version: EnvGatewayComponent.Version,
        options: [
            {
                name: 'core',
                description: 'The gateway process: how long shutdown drains.',
                settings: [
                    { name: 'drainTimeoutMs', type: SettingType.Integer, source: 'PRAGMATIC_DRAIN_TIMEOUT_MS', default: 25000, description: 'How long shutdown waits for connections to drain, in milliseconds.' },
                ],
            },
            {
                ...ServerOptionDeclarations.Observability,
                settings: ServerOptionDeclarations.Observability.settings.filter(setting => setting.name !== EnvGatewayComponent.MetricsPort),
            },
            ServerOptionDeclarations.RateLimit,
            ServerOptionDeclarations.WebSocket,
        ],
        roles: [],
        postgres: false,
        ports: [{ name: 'http', number: 8080 }],
        health: { port: 'http', path: '/healthz' },
    }

    public static Descriptor(): ComponentDescriptor
    {
        return ComponentDeclarations.Build(EnvGatewayComponent.Declaration)
    }
}
