import { AgentEngineManager } from '@/components/agent-engine-manager';

export default function MemorySettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <AgentEngineManager />
      </div>
    </div>
  );
}
