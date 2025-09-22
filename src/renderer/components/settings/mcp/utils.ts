import * as shellQuote from 'shell-quote'
import { v4 as uuid } from 'uuid'
import z from 'zod'
import type { MCPServerConfig } from '@/packages/mcp/types'

const envUtils = {
  parse: (env: string): Record<string, string> => {
    const lines = env.split('\n')
    const result: Record<string, string> = {}
    for (const line of lines) {
      const eqIndex = line.indexOf('=')
      if (eqIndex === -1) continue
      const key = line.slice(0, eqIndex)
      const value = line.slice(eqIndex + 1)
      if (key && value && key.trim() && value.trim()) {
        result[key.trim()] = value.trim()
      }
    }
    return result
  },
  stringify: (env: Record<string, string>): string => {
    return Object.entries(env)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')
  },
}

export type MCPServerConfigFormValues = MCPServerConfig<
  | {
      type: 'stdio'
      command: string
      env?: string
    }
  | {
      type: 'http'
      url: string
      headers?: string
    }
>

export function getConfigFromFormValues(values: MCPServerConfigFormValues): MCPServerConfig {
  let transport: MCPServerConfig['transport']
  if (values.transport.type === 'stdio') {
    const [command, ...args] = shellQuote.parse(values.transport.command)
    transport = {
      type: 'stdio',
      command: command.toString(),
      args: args.filter((arg) => typeof arg === 'string'),
      env: values.transport.env ? envUtils.parse(values.transport.env) : undefined,
    }
  } else {
    transport = {
      type: values.transport.type,
      url: values.transport.url,
      headers: values.transport.headers ? envUtils.parse(values.transport.headers) : undefined,
    }
  }
  return {
    id: values.id,
    name: values.name,
    enabled: values.enabled,
    transport,
  }
}

export function getFormValuesFromConfig(config: MCPServerConfig): MCPServerConfigFormValues {
  let transport: MCPServerConfigFormValues['transport']
  if (config.transport.type === 'stdio') {
    transport = {
      type: 'stdio',
      command: `${config.transport.command} ${config.transport.args.join(' ')}`,
      env: config.transport.env ? envUtils.stringify(config.transport.env) : undefined,
    }
  } else {
    transport = {
      type: config.transport.type,
      url: config.transport.url,
      headers: config.transport.headers ? envUtils.stringify(config.transport.headers) : undefined,
    }
  }
  return {
    id: config.id,
    name: config.name,
    enabled: config.enabled,
    transport,
  }
}

const serverConfigSchema = z.union([
  z
    .object({
      command: z.string(),
      args: z.array(z.string()),
      env: z.record(z.string(), z.string()).optional(),
      name: z.string().optional(),
    })
    .transform((data) => ({ ...data, type: 'stdio' as const })),
  z
    .object({
      url: z.string(),
      headers: z.record(z.string(), z.string()).optional(),
      name: z.string().optional(),
    })
    .transform((data) => ({ ...data, type: 'http' as const })),
])

export function parseServerFromJson(text: string): MCPServerConfig | undefined {
  const json = JSON.parse(text)
  const parsed = serverConfigSchema.parse(json)
  return {
    id: uuid(),
    name: parsed.name ?? '',
    enabled: true,
    transport: parsed,
  }
}

export function parseServersFromJson(text: string): MCPServerConfig[] {
  try {
    const json = JSON.parse(text)
    const servers: MCPServerConfig[] = []
    for (const [key, value] of Object.entries(json.mcpServers)) {
      try {
        const parsed = serverConfigSchema.parse(value)
        servers.push({
          id: uuid(),
          name: parsed.name ?? key,
          enabled: false,
          transport: parsed,
        })
      } catch (err) {
        console.error(err)
      }
    }
    return servers
  } catch (err) {
    console.error(err)
    return []
  }
}
