import { Agent, type AgentOptions } from './agent.ts'
import type { AgentView } from './types.ts'

/** Sessions this app owns and can drive — distinct from the desktop sessions it merely observes. */
export class AgentRegistry {
  private agents = new Map<string, Agent>()

  constructor(private onChange: () => void) {}

  create(opts: AgentOptions): Agent {
    const agent = new Agent(opts, this.onChange)
    this.agents.set(agent.id, agent)
    agent.start()
    return agent
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id)
  }

  remove(id: string): boolean {
    const agent = this.agents.get(id)
    if (!agent) return false
    agent.stop()
    this.agents.delete(id)
    this.onChange()
    return true
  }

  views(): AgentView[] {
    return [...this.agents.values()].map((a) => a.view())
  }

  stopAll(): void {
    for (const a of this.agents.values()) a.stop()
    this.agents.clear()
  }
}
