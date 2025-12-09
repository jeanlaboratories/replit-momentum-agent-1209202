import vertexai
from vertexai.preview import reasoning_engines
import google.auth
import os

# Define the agent class at the top level so it can be pickled correctly
class SimpleAgent:
    def __init__(self):
        pass
        
    def query(self, question: str) -> str:
        """Returns a simple response."""
        return f"I received your question: {question}"

def create_agent_engine():
    try:
        # Get default credentials and project
        credentials, project_id = google.auth.default()
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        
        print(f"Project ID: {project_id}")
        print(f"Location: {location}")
        
        # Initialize Vertex AI with staging bucket
        staging_bucket = f"gs://{project_id}-momentum-staging"
        print(f"Staging Bucket: {staging_bucket}")
        vertexai.init(project=project_id, location=location, staging_bucket=staging_bucket)
        
        # Create the agent
        print("Creating Agent Engine (V3 - Top Level Class)...")
        
        # Deploy the agent
        remote_agent = reasoning_engines.ReasoningEngine.create(
            SimpleAgent(),
            requirements=[],
            display_name="Momentum Agent Engine (V3)",
            description="Minimal Agent Engine for Memory Bank",
        )
        
        print("\n✅ Agent Engine created successfully!")
        print(f"Display Name: {remote_agent.display_name}")
        print(f"Resource Name: {remote_agent.resource_name}")
        
        if hasattr(remote_agent, 'resource_name'):
            agent_id = remote_agent.resource_name.split("/")[-1]
            print(f"\nAGENT_ENGINE_ID: {agent_id}")
            print("\nPlease add this ID to your .env file as MOMENTUM_AGENT_ENGINE_ID")
            
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    create_agent_engine()
