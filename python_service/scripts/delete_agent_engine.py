import os
import argparse
import asyncio
from dotenv import load_dotenv
import vertexai
from vertexai.preview import reasoning_engines

async def main():
    """
    Deletes a Vertex AI Agent Engine.
    """
    # Construct the absolute path to the .env file in the project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    dotenv_path = os.path.join(project_root, '.env')
    load_dotenv(dotenv_path=dotenv_path)
    print(f"Loading .env from: {dotenv_path}") # Diagnostic print

    parser = argparse.ArgumentParser(description="Delete a Vertex AI Agent Engine.")
    parser.add_argument("--agent-engine-id", help="The ID of the Agent Engine to delete. Defaults to the value in your .env file.")
    args = parser.parse_args()

    agent_engine_id = args.agent_engine_id or os.getenv('MOMENTUM_AGENT_ENGINE_ID')
    location = os.getenv('MOMENTUM_AGENT_ENGINE_LOCATION')
    project = os.getenv('MOMENTUM_GOOGLE_CLOUD_PROJECT')

    if not all([agent_engine_id, location, project]):
        print("Error: Please ensure MOMENTUM_AGENT_ENGINE_ID, MOMENTUM_AGENT_ENGINE_LOCATION, and MOMENTUM_GOOGLE_CLOUD_PROJECT are set in your .env file, or provide the --agent-engine-id.")
        return

    print(f"Initializing Vertex AI for project '{project}' in location '{location}'...")
    vertexai.init(project=project, location=location)

    try:
        resource_name = f"projects/{project}/locations/{location}/reasoningEngines/{agent_engine_id}"
        print(f"Attempting to delete Agent Engine with resource name: {resource_name}")
        
        # Get the reasoning engine object
        engine = reasoning_engines.ReasoningEngine(resource_name)
        
        # Delete the engine
        engine.delete()
        
        print(f"\nSuccessfully initiated deletion of Agent Engine ID: {agent_engine_id}")
        print("It may take a few moments for the deletion to complete in the Google Cloud console.")

    except Exception as e:
        print(f"An error occurred while deleting the Agent Engine: {e}")
        print("Please check that the Agent Engine ID is correct and that you have the necessary permissions.")

if __name__ == "__main__":
    asyncio.run(main())
