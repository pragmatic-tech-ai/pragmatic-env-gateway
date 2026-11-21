import { ContainerComponentSource, ReleaseApp } from '@pragmatic-tech-ai/pragmatic-release-toolkit'
import { EnvGatewayComponent } from './bin/env-gateway-component.js'

/**
 * This repository's one component, as `pragmatic-component-descriptors --components dist/release-components.js` reads
 * it (the Dockerfile's component stages): the env gateway's descriptor class.
 */
export const Components = new ContainerComponentSource(ReleaseApp.EnvGateway, () => EnvGatewayComponent.Descriptor())
