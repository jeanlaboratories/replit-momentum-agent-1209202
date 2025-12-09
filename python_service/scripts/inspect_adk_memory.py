import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Load environment variables
load_dotenv()

from google.adk.memory import VertexAiMemoryBankService

print("Help for VertexAiMemoryBankService:")
help(VertexAiMemoryBankService)
