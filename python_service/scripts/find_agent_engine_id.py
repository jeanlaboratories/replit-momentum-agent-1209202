import vertexai
from vertexai.preview import reasoning_engines
import google.auth
import os

def find_agent_engines():
    try:
        # Get default credentials and project
        credentials, project_id = google.auth.default()
        
        # Allow overriding location via env var, default to us-central1
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        
        print(f"Project ID: {project_id}")
        print(f"Location: {location}")
        
        # Initialize Vertex AI
        vertexai.init(project=project_id, location=location)
        
        # List agents
        print("\nSearching for Agent Engines...")
        try:
            agents = reasoning_engines.ReasoningEngine.list()
        except Exception as list_err:
            print(f"Error listing agents: {list_err}")
            return

        if not agents:
            print("No Agent Engines found in this project/location.")
            return

        print(f"Found {len(agents)} Agent Engine(s):")
        print("-" * 40)
        
        for agent in agents:
            print(f"Display Name: {agent.display_name}")
            print(f"Resource Name: {agent.resource_name}")
            
            # Extract ID
            # Format: projects/{project}/locations/{location}/reasoningEngines/{AGENT_ENGINE_ID}
            if hasattr(agent, 'resource_name'):
                agent_id = agent.resource_name.split("/")[-1]
                print(f"AGENT_ENGINE_ID: {agent_id}")
            
            print("-" * 40)
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    find_agent_engines()
