export type Fill = { tokens: number; window: number; percent: number }

declare module 'claude-code' {
  interface PluginState {
    'context-gauge': { fill: Fill | null; warnedLevel: number }
  }
}
