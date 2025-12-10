import logging
import json
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from firebase_admin import firestore
from agent_engine_manager import create_agent_engine, delete_agent_engine

from config import get_settings
from config.exceptions import ValidationError, ProcessingError

router = APIRouter(prefix="/agent", tags=["memory"])
logger = logging.getLogger(__name__)


def get_firestore_collection_path(memory_type: str, entity_id: str) -> str:
    """Get the Firestore collection path for memories based on type."""
    if memory_type == 'team':
        return f'brands/{entity_id}/memories'
    else:
        return f'users/{entity_id}/memories'


def get_agent_engine_id_from_doc(doc_data: dict, memory_type: str) -> str:
    """Get the agent engine ID field based on memory type."""
    if memory_type == 'team':
        return doc_data.get('teamAgentEngineId')
    else:
        return doc_data.get('agentEngineId')


@router.post("/create-engine")
async def create_engine(request: Request):
    """
    Creates a new Vertex AI Agent Engine.

    Supports both personal (user) and team (brand) memory engines.

    Body params:
    - user_id: Required for personal type
    - brand_id: Required for team type
    - type: 'personal' or 'team' (defaults to 'personal')
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        brand_id = data.get('brand_id')
        memory_type = data.get('type', 'personal')

        if memory_type == 'team':
            if not brand_id:
                raise HTTPException(
                    status_code=400,
                    detail="brand_id is required for team memory engine")
            result = await create_agent_engine(brand_id=brand_id,
                                               memory_type='team')
        else:
            if not user_id:
                raise HTTPException(
                    status_code=400,
                    detail="user_id is required for personal memory engine")
            result = await create_agent_engine(user_id=user_id,
                                               memory_type='personal')

        # Check if the result indicates an error
        if result.get('status') == 'error':
            logger.error(
                f"Agent engine creation failed: {result.get('message')}")
            raise HTTPException(status_code=500,
                                detail=result.get(
                                    'message',
                                    'Failed to create agent engine'))

        return JSONResponse(content=result)
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error creating engine: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/delete-engine")
async def delete_engine(request: Request):
    """
    Deletes a Vertex AI Agent Engine.

    Supports both personal (user) and team (brand) memory engines.

    Body params:
    - user_id: Required for personal type
    - brand_id: Required for team type
    - type: 'personal' or 'team' (defaults to 'personal')
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        brand_id = data.get('brand_id')
        memory_type = data.get('type', 'personal')

        if memory_type == 'team':
            if not brand_id:
                raise HTTPException(
                    status_code=400,
                    detail="brand_id is required for team memory engine")
            result = await delete_agent_engine(brand_id=brand_id,
                                               memory_type='team')
        else:
            if not user_id:
                raise HTTPException(
                    status_code=400,
                    detail="user_id is required for personal memory engine")
            result = await delete_agent_engine(user_id=user_id,
                                               memory_type='personal')

        # Check if the result indicates an error
        if result.get('status') == 'error':
            logger.error(
                f"Agent engine deletion failed: {result.get('message')}")
            raise HTTPException(status_code=500,
                                detail=result.get(
                                    'message',
                                    'Failed to delete agent engine'))

        return JSONResponse(content=result)
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error deleting engine: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/memories/list")
async def list_memories(request: Request):
    """
    Lists memories from either personal or team memory bank.

    Body params:
    - user_id: Required for personal type
    - brand_id: Required for team type
    - type: 'personal' or 'team' (defaults to 'personal')
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        brand_id = data.get('brand_id')
        memory_type = data.get('type', 'personal')

        # Validate required params
        if memory_type == 'team':
            if not brand_id:
                raise HTTPException(
                    status_code=400,
                    detail="brand_id is required for team memories")
            entity_id = brand_id
            collection_path = 'brands'
            engine_id_field = 'teamAgentEngineId'
        else:
            if not user_id:
                raise HTTPException(
                    status_code=400,
                    detail="user_id is required for personal memories")
            entity_id = user_id
            collection_path = 'users'
            engine_id_field = 'agentEngineId'

        db = firestore.client()

        # 1. Try to list from Vertex AI Agent Engine
        try:
            doc = db.collection(collection_path).document(entity_id).get()
            if not doc.exists:
                logger.warning(f"Document not found for {entity_id}")
                return JSONResponse(content={
                    "status": "success",
                    "memories": [],
                    "message": "Entity not found"
                },
                                    status_code=200)

            agent_engine_id = doc.to_dict().get(engine_id_field)
            logger.info(
                f"Listing {memory_type} memories for {entity_id}, agent_engine_id: {agent_engine_id}"
            )

            if agent_engine_id:
                # Use vertexai.Client (same as ADK notebook approach for saving)
                import vertexai
                settings = get_settings()
                project_id = settings.effective_project_id
                location = settings.agent_engine_location

                logger.info(
                    f"Initializing vertexai for listing memories: project={project_id}, location={location}, engine={agent_engine_id}"
                )

                # Initialize vertexai client (same as ADK notebook)
                vertexai.init(project=project_id, location=location)
                client = vertexai.Client(project=project_id, location=location)

                logger.info(f"Created vertexai.Client: type={type(client).__name__}, has agent_engines={hasattr(client, 'agent_engines')}")

                agent_engine_name = f'projects/{project_id}/locations/{location}/reasoningEngines/{agent_engine_id}'

                logger.info(
                    f"Attempting to list memories from Vertex AI for engine {agent_engine_id}"
                )
                memories_list = client.agent_engines.memories.list(
                    name=agent_engine_name)

                vertex_memories = []
                for memory in memories_list:
                    content = getattr(memory, 'fact', 'N/A')
                    create_time = getattr(memory, 'create_time', None)

                    created_at_str = None
                    if create_time:
                        if hasattr(create_time, 'isoformat'):
                            created_at_str = create_time.isoformat()
                        else:
                            created_at_str = str(create_time)

                    # Store both the short ID and the full name for deletion
                    memory_id = memory.name.split('/')[-1]
                    
                    # Try to find the corresponding Firestore document to get the actual document ID
                    # This ensures we use the correct ID for deletion
                    firestore_doc_id = memory_id  # Default to short ID
                    memories_ref = db.collection(collection_path).document(
                        entity_id).collection('memories')
                    
                    # First try to find by adkMemoryId matching the full name
                    query = memories_ref.where('adkMemoryId', '==', memory.name).limit(1)
                    matching_docs = list(query.stream())
                    if matching_docs:
                        firestore_doc_id = matching_docs[0].id
                        logger.info(
                            f"Found Firestore doc for Vertex AI memory: vertex_id={memory_id}, firestore_doc_id={firestore_doc_id}, full_name={memory.name}"
                        )
                    else:
                        # Try to find by document ID matching the short memory ID
                        # (memories created with Vertex AI ID as doc ID)
                        doc_ref = memories_ref.document(memory_id)
                        if doc_ref.get().exists:
                            firestore_doc_id = memory_id
                            logger.info(
                                f"Found Firestore doc by ID match: firestore_doc_id={firestore_doc_id}, vertex_id={memory_id}"
                            )
                        else:
                            logger.warning(
                                f"No Firestore doc found for Vertex AI memory: vertex_id={memory_id}, full_name={memory.name}"
                            )
                    
                    logger.info(
                        f"Listed memory: vertex_id={memory_id}, firestore_doc_id={firestore_doc_id}, full_name={memory.name}"
                    )

                    vertex_memories.append({
                        'id': firestore_doc_id,  # Use Firestore document ID for reliable deletion
                        'fullName': memory.name,  # Store full resource name for deletion
                        'content': content,
                        'createdAt': created_at_str,
                        'source': 'vertex',
                        'scope': memory_type
                    })

                logger.info(
                    f"Found {len(vertex_memories)} {memory_type} memories in Vertex AI"
                )
                if vertex_memories:
                    return JSONResponse(content={
                        "status": "success",
                        "memories": vertex_memories
                    },
                                        status_code=200)
                else:
                    logger.info(
                        "No memories found in Vertex AI, falling back to Firestore"
                    )
            else:
                logger.warning(
                    f"No agent_engine_id found for {entity_id}, falling back to Firestore"
                )
        except Exception as vertex_e:
            logger.warning(
                f"Failed to list memories from Vertex AI: {vertex_e}. Falling back to Firestore."
            )
            import traceback
            logger.warning(traceback.format_exc())

        # 2. Fallback to Firestore
        memories_ref = db.collection(collection_path).document(
            entity_id).collection('memories')
        docs = memories_ref.order_by(
            'createdAt', direction=firestore.Query.DESCENDING).stream()

        memories = []
        for doc in docs:
            data = doc.to_dict()
            memory = {
                'id':
                doc.id,
                'content':
                data.get('content', ''),
                'createdAt':
                data.get('createdAt').isoformat()
                if data.get('createdAt') else None,
                'adkMemoryId':
                data.get('adkMemoryId'),
                'source':
                'firestore',
                'scope':
                memory_type
            }
            memories.append(memory)

        return JSONResponse(content={
            "status": "success",
            "memories": memories
        },
                            status_code=200)
    except Exception as e:
        logger.error(f"Error listing memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/memories/delete")
async def delete_memory(request: Request):
    """
    Deletes a specific memory from either personal or team memory bank.

    Body params:
    - user_id: Required for personal type
    - brand_id: Required for team type
    - memory_id: The ID of the memory to delete
    - full_name: Optional full resource name for direct Vertex AI deletion
    - type: 'personal' or 'team' (defaults to 'personal')
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        brand_id = data.get('brand_id')
        memory_id = data.get('memory_id')
        full_name = data.get('full_name')  # Full Vertex AI resource name
        memory_type = data.get('type', 'personal')

        if not memory_id:
            raise HTTPException(status_code=400,
                                detail="memory_id is required")

        logger.info(
            f"Delete memory request: memory_id={memory_id}, full_name={full_name}, type={memory_type}"
        )

        # Validate required params
        if memory_type == 'team':
            if not brand_id:
                raise HTTPException(
                    status_code=400,
                    detail="brand_id is required for team memories")
            entity_id = brand_id
            collection_path = 'brands'
            engine_id_field = 'teamAgentEngineId'
        else:
            if not user_id:
                raise HTTPException(
                    status_code=400,
                    detail="user_id is required for personal memories")
            entity_id = user_id
            collection_path = 'users'
            engine_id_field = 'agentEngineId'

        db = firestore.client()

        # 1. Try to delete from Vertex AI if possible
        vertex_deleted = False
        firestore_deleted = False
        try:
            doc = db.collection(collection_path).document(entity_id).get()
            if not doc.exists:
                logger.warning(
                    f"Entity document not found: {collection_path}/{entity_id}"
                )
                return {
                    "status": "error",
                    "message": f"Entity not found: {entity_id}"
                }

            doc_data = doc.to_dict() or {}
            agent_engine_id = doc_data.get(engine_id_field)
            logger.info(
                f"Deleting memory {memory_id} from {memory_type} bank, agent_engine_id={agent_engine_id}"
            )

            # Get ADK memory ID from Firestore (if memory was created with Firestore tracking)
            # First try to find by document ID (memory_id)
            memories_ref = db.collection(collection_path).document(
                entity_id).collection('memories')
            memory_doc_ref = memories_ref.document(memory_id)
            memory_doc = memory_doc_ref.get()
            adk_memory_id = memory_doc.to_dict().get(
                'adkMemoryId') if memory_doc.exists else None
            logger.info(
                f"Firestore memory doc exists (by ID {memory_id}): {memory_doc.exists}, adk_memory_id: {adk_memory_id}"
            )
            
            # If not found by direct ID and we have full_name, try to find by adkMemoryId
            if not memory_doc.exists and full_name:
                logger.info(f"Memory not found by ID {memory_id}, searching by full_name: {full_name}")
                query = memories_ref.where('adkMemoryId', '==', full_name).limit(1)
                matching_docs = list(query.stream())
                if matching_docs:
                    memory_doc = matching_docs[0]
                    memory_doc_ref = memory_doc.reference
                    adk_memory_id = memory_doc.to_dict().get('adkMemoryId')
                    logger.info(f"Found memory by adkMemoryId: doc_id={memory_doc.id}, adkMemoryId={adk_memory_id}")
                else:
                    # Also try matching by short memory ID in adkMemoryId
                    # Extract short ID from full_name if it's a full path
                    short_id_from_full = full_name.split('/')[-1] if '/' in full_name else full_name
                    query2 = memories_ref.where('adkMemoryId', '>=', '').limit(100)
                    for doc in query2.stream():
                        doc_data = doc.to_dict()
                        adk_id = doc_data.get('adkMemoryId', '')
                        if adk_id and (adk_id.endswith(f'/{short_id_from_full}') or adk_id == short_id_from_full or adk_id.endswith(f'/{memory_id}') or adk_id == memory_id):
                            memory_doc = doc
                            memory_doc_ref = doc.reference
                            adk_memory_id = adk_id
                            logger.info(f"Found memory by adkMemoryId pattern match: doc_id={doc.id}, adkMemoryId={adk_id}")
                            break

            # If no adkMemoryId in Firestore, the memory_id itself might be the Vertex AI memory ID
            # (this happens when memories are listed directly from Vertex AI)
            if agent_engine_id:
                # Use vertexai.Client (same as ADK notebook approach for saving)
                import vertexai
                settings = get_settings()
                project_id = settings.effective_project_id
                location = settings.agent_engine_location

                logger.info(f"Initializing vertexai for memory deletion: project={project_id}, location={location}, engine_id={agent_engine_id}")

                # Initialize vertexai client (same as ADK notebook)
                vertexai.init(project=project_id, location=location)
                client = vertexai.Client(project=project_id, location=location)

                logger.info(f"Created vertexai.Client: type={type(client).__name__}, has agent_engines={hasattr(client, 'agent_engines')}")

                # Use full_name directly if provided (most reliable), otherwise construct it
                if full_name:
                    memory_name = full_name
                    logger.info(
                        f"Using provided full_name for deletion: {memory_name}"
                    )
                else:
                    # Try with adk_memory_id first, then fall back to memory_id
                    vertex_memory_id = adk_memory_id or memory_id
                    memory_name = f'projects/{project_id}/locations/{location}/reasoningEngines/{agent_engine_id}/memories/{vertex_memory_id}'
                    logger.info(
                        f"Constructed memory_name for deletion: {memory_name}")

                try:
                    logger.info(f"Calling client.agent_engines.memories.delete() with name={memory_name}")
                    client.agent_engines.memories.delete(name=memory_name)
                    logger.info(
                        f"Deleted {memory_type} memory from Vertex AI: {memory_name}"
                    )
                    vertex_deleted = True
                except Exception as delete_e:
                    logger.error(f"Failed to delete memory from Vertex AI: {delete_e}")
                    import traceback
                    logger.error(traceback.format_exc())
        except Exception as vertex_e:
            logger.warning(
                f"Failed to delete memory from Vertex AI: {vertex_e}. Proceeding with Firestore deletion."
            )

        # 2. Delete from Firestore (ALWAYS attempt, regardless of Vertex AI success)
        # Use the memory_doc_ref we found earlier (either by ID or by adkMemoryId search)
        try:
            # memories_ref is already defined above, but ensure it's available here
            if 'memories_ref' not in locals():
                memories_ref = db.collection(collection_path).document(
                    entity_id).collection('memories')
            
            # Use the memory_doc_ref we already found (either by ID or by adkMemoryId search)
            # This ensures we're working with the correct document
            if memory_doc.exists:
                # Delete using the document reference we already have
                memory_doc_ref.delete()
                firestore_deleted = True
                actual_doc_id = memory_doc.id if hasattr(memory_doc, 'id') else memory_id
                logger.info(
                    f"Deleted {memory_type} memory from Firestore by doc ID: {actual_doc_id}"
                )
            else:
                # Document doesn't exist by direct ID, try to find by adkMemoryId
                # This should have been found in the earlier search, but if not, try again here
                logger.info(f"Memory doc not found by ID {memory_id}, searching by adkMemoryId")
                
                # Try to find by adkMemoryId field (for memories listed from Vertex AI)
                # The full_name contains the Vertex AI path, and memory_id is the short ID
                if full_name:
                    query = memories_ref.where('adkMemoryId', '==', full_name).limit(1)
                    matching_docs = list(query.stream())
                    
                    if matching_docs:
                        matching_docs[0].reference.delete()
                        firestore_deleted = True
                        logger.info(
                            f"Deleted {memory_type} memory from Firestore by adkMemoryId (full_name): {matching_docs[0].id}"
                        )
                    else:
                        # Try matching by short memory ID in adkMemoryId
                        # Extract short ID from full_name if it's a full path
                        short_id_from_full = full_name.split('/')[-1] if '/' in full_name else full_name
                        query2 = memories_ref.where('adkMemoryId', '>=', '').limit(100)
                        for doc in query2.stream():
                            doc_data = doc.to_dict()
                            adk_id = doc_data.get('adkMemoryId', '')
                            if adk_id:
                                # Check if adkMemoryId ends with /memory_id or /short_id_from_full
                                if (adk_id.endswith(f'/{memory_id}') or adk_id == memory_id or
                                    adk_id.endswith(f'/{short_id_from_full}') or adk_id == short_id_from_full):
                                    doc.reference.delete()
                                    firestore_deleted = True
                                    logger.info(
                                        f"Deleted {memory_type} memory from Firestore by adkMemoryId match: {doc.id} (adkMemoryId: {adk_id})"
                                    )
                                    break
                
                # If still not found and we have adk_memory_id from earlier, try that
                if not firestore_deleted and adk_memory_id:
                    query3 = memories_ref.where('adkMemoryId', '==', adk_memory_id).limit(1)
                    matching_docs = list(query3.stream())
                    if matching_docs:
                        matching_docs[0].reference.delete()
                        firestore_deleted = True
                        logger.info(
                            f"Deleted {memory_type} memory from Firestore by adkMemoryId (from doc): {matching_docs[0].id}"
                        )
                
                if not firestore_deleted:
                    logger.warning(
                        f"Memory {memory_id} not found in Firestore for deletion (full_name: {full_name})"
                    )
        except Exception as fs_e:
            logger.error(f"Failed to delete memory from Firestore: {fs_e}")
            import traceback
            logger.error(traceback.format_exc())

        if vertex_deleted or firestore_deleted:
            return {"status": "success"}
        else:
            logger.warning(
                f"Memory {memory_id} not found in Vertex AI or Firestore")
            return {
                "status": "success",
                "message": "Memory may have already been deleted"
            }
    except Exception as e:
        logger.error(f"Error deleting memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/clear-memories")
async def clear_memories(request: Request):
    """
    Clears all memories from either personal or team memory bank.

    Body params:
    - user_id: Required for personal type
    - brand_id: Required for team type
    - type: 'personal' or 'team' (defaults to 'personal')
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        brand_id = data.get('brand_id')
        memory_type = data.get('type', 'personal')

        # Validate required params
        if memory_type == 'team':
            if not brand_id:
                raise HTTPException(
                    status_code=400,
                    detail="brand_id is required for team memories")
            entity_id = brand_id
            collection_path = 'brands'
            engine_id_field = 'teamAgentEngineId'
        else:
            if not user_id:
                raise HTTPException(
                    status_code=400,
                    detail="user_id is required for personal memories")
            entity_id = user_id
            collection_path = 'users'
            engine_id_field = 'agentEngineId'

        db = firestore.client()

        # 1. Try to clear from Vertex AI
        try:
            doc = db.collection(collection_path).document(entity_id).get()
            agent_engine_id = doc.to_dict().get(engine_id_field)

            if agent_engine_id:
                # Use vertexai.Client (same as ADK notebook approach for saving)
                import vertexai
                settings = get_settings()
                project_id = settings.effective_project_id
                location = settings.agent_engine_location

                logger.info(f"Initializing vertexai for clearing memories: project={project_id}, location={location}, engine_id={agent_engine_id}")

                # Initialize vertexai client (same as ADK notebook)
                vertexai.init(project=project_id, location=location)
                client = vertexai.Client(project=project_id, location=location)

                logger.info(f"Created vertexai.Client: type={type(client).__name__}, has agent_engines={hasattr(client, 'agent_engines')}")

                agent_engine_name = f'projects/{project_id}/locations/{location}/reasoningEngines/{agent_engine_id}'

                # ADK doesn't have a clear_all, we have to list and delete each
                logger.info(f"Listing memories from Vertex AI: {agent_engine_name}")
                memories_list = client.agent_engines.memories.list(
                    name=agent_engine_name)
                
                deleted_count = 0
                for memory in memories_list:
                    try:
                        logger.info(f"Deleting memory from Vertex AI: {memory.name}")
                        client.agent_engines.memories.delete(name=memory.name)
                        deleted_count += 1
                    except Exception as delete_e:
                        logger.warning(f"Failed to delete memory {memory.name} from Vertex AI: {delete_e}")
                
                logger.info(
                    f"Cleared {deleted_count} {memory_type} memories from Vertex AI for engine {agent_engine_id}"
                )
        except Exception as vertex_e:
            logger.error(f"Failed to clear memories from Vertex AI: {vertex_e}")
            import traceback
            logger.error(traceback.format_exc())
            logger.warning("Proceeding with Firestore clear.")

        # 2. Clear from Firestore
        memories_ref = db.collection(collection_path).document(
            entity_id).collection('memories')
        docs = memories_ref.stream()
        for doc in docs:
            doc.reference.delete()

        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error clearing memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/memories/bulk-add")
async def bulk_add_memories(request: Request):
    """
    Adds multiple memories at once to either personal or team memory bank.
    Used for committing Brand Soul insights to memory.

    Body params:
    - user_id: Required for personal type
    - brand_id: Required for team type
    - type: 'personal' or 'team' (defaults to 'personal')
    - memories: List of memory objects with metadata:
        - content: The memory text
        - sourceArtifactId: ID of the source artifact
        - sourceArtifactTitle: Title of the source artifact
        - sourceBrandId: Brand ID
        - insightElementType: Type of insight element
      (Also supports legacy format: list of plain strings)
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        brand_id = data.get('brand_id')
        memory_type = data.get('type', 'personal')
        memories = data.get('memories', [])

        if not memories:
            return JSONResponse(content={
                "status": "success",
                "added": 0
            },
                                status_code=200)

        # Validate required params
        if memory_type == 'team':
            if not brand_id:
                raise HTTPException(
                    status_code=400,
                    detail="brand_id is required for team memories")
            entity_id = brand_id
            collection_path = 'brands'
            engine_id_field = 'teamAgentEngineId'
        else:
            if not user_id:
                raise HTTPException(
                    status_code=400,
                    detail="user_id is required for personal memories")
            entity_id = user_id
            collection_path = 'users'
            engine_id_field = 'agentEngineId'

        db = firestore.client()
        doc = db.collection(collection_path).document(entity_id).get()

        if not doc.exists:
            raise HTTPException(
                status_code=404,
                detail=f"{collection_path.rstrip('s')} not found")

        agent_engine_id = doc.to_dict().get(engine_id_field)
        added_count = 0
        errors = []

        # Helper to extract memory content and metadata
        def extract_memory_data(memory_item):
            """Extract content and metadata from memory item (supports both dict and string)."""
            if isinstance(memory_item, dict):
                return {
                    'content': memory_item.get('content', ''),
                    'sourceArtifactId': memory_item.get('sourceArtifactId'),
                    'sourceArtifactTitle':
                    memory_item.get('sourceArtifactTitle'),
                    'sourceBrandId': memory_item.get('sourceBrandId'),
                    'insightElementType':
                    memory_item.get('insightElementType'),
                }
            else:
                # Legacy format: plain string
                return {'content': str(memory_item)}

        # Try to add to Vertex AI Memory Bank
        if agent_engine_id:
            try:
                # Use vertexai.Client (same as ADK notebook approach for saving)
                import vertexai
                settings = get_settings()
                project_id = settings.effective_project_id
                location = settings.agent_engine_location

                logger.info(f"Initializing vertexai for bulk adding memories: project={project_id}, location={location}, engine_id={agent_engine_id}")

                # Initialize vertexai client (same as ADK notebook)
                vertexai.init(project=project_id, location=location)
                client = vertexai.Client(project=project_id, location=location)

                logger.info(f"Created vertexai.Client: type={type(client).__name__}, has agent_engines={hasattr(client, 'agent_engines')}")

                agent_engine_name = f'projects/{project_id}/locations/{location}/reasoningEngines/{agent_engine_id}'

                for memory_item in memories:
                    memory_data = extract_memory_data(memory_item)
                    memory_text = memory_data['content']

                    try:
                        # Create memory in Vertex AI
                        scope = {
                            "brand_id": brand_id
                        } if memory_type == 'team' else {
                            "user_id": user_id
                        }
                        operation = client.agent_engines.memories.create(
                            name=agent_engine_name,
                            fact=memory_text,
                            scope=scope)

                        # Get memory ID if available
                        adk_memory_id = None
                        if hasattr(operation, 'name'):
                            adk_memory_id = operation.name

                        # Build Firestore document with source metadata
                        firestore_doc = {
                            'content': memory_text,
                            'createdAt': firestore.SERVER_TIMESTAMP,
                            'updatedAt': firestore.SERVER_TIMESTAMP,
                            'adkMemoryId': adk_memory_id,
                            'source': 'brand_soul_insight'
                        }
                        # Add source tracking fields if available
                        if memory_data.get('sourceArtifactId'):
                            firestore_doc['sourceArtifactId'] = memory_data[
                                'sourceArtifactId']
                        if memory_data.get('sourceArtifactTitle'):
                            firestore_doc['sourceArtifactTitle'] = memory_data[
                                'sourceArtifactTitle']
                        if memory_data.get('sourceBrandId'):
                            firestore_doc['sourceBrandId'] = memory_data[
                                'sourceBrandId']
                        if memory_data.get('insightElementType'):
                            firestore_doc['insightElementType'] = memory_data[
                                'insightElementType']

                        # Use adk_memory_id as document ID if available for easier deletion
                        memories_col = db.collection(collection_path).document(
                            entity_id).collection('memories')
                        
                        if adk_memory_id:
                            # Extract short memory ID from full path for use as document ID
                            short_memory_id = adk_memory_id.split('/')[-1] if '/' in adk_memory_id else adk_memory_id
                            memories_col.document(short_memory_id).set(firestore_doc)
                            logger.info(f"Saved bulk memory to Firestore with ID {short_memory_id} (from adk_memory_id)")
                        else:
                            # Fallback to auto-generated ID if no adk_memory_id
                            memories_col.add(firestore_doc)
                        added_count += 1
                    except Exception as mem_e:
                        logger.warning(
                            f"Failed to add memory to Vertex AI: {mem_e}")
                        errors.append(str(mem_e))
                        # Still save to Firestore as fallback with source metadata
                        firestore_doc = {
                            'content': memory_text,
                            'createdAt': firestore.SERVER_TIMESTAMP,
                            'updatedAt': firestore.SERVER_TIMESTAMP,
                            'source': 'brand_soul_insight'
                        }
                        if memory_data.get('sourceArtifactId'):
                            firestore_doc['sourceArtifactId'] = memory_data[
                                'sourceArtifactId']
                        if memory_data.get('sourceArtifactTitle'):
                            firestore_doc['sourceArtifactTitle'] = memory_data[
                                'sourceArtifactTitle']
                        if memory_data.get('sourceBrandId'):
                            firestore_doc['sourceBrandId'] = memory_data[
                                'sourceBrandId']
                        if memory_data.get('insightElementType'):
                            firestore_doc['insightElementType'] = memory_data[
                                'insightElementType']

                        # Use auto-generated ID for fallback (no Vertex AI ID available)
                        db.collection(collection_path).document(
                            entity_id).collection('memories').add(
                                firestore_doc)
                        added_count += 1

                logger.info(
                    f"Added {added_count} memories to {memory_type} bank for {entity_id}"
                )
            except Exception as vertex_e:
                logger.error(
                    f"Failed to initialize Vertex AI memory service: {vertex_e}"
                )
                # Fallback to Firestore only
                for memory_item in memories:
                    memory_data = extract_memory_data(memory_item)
                    firestore_doc = {
                        'content': memory_data['content'],
                        'createdAt': firestore.SERVER_TIMESTAMP,
                        'updatedAt': firestore.SERVER_TIMESTAMP,
                        'source': 'brand_soul_insight'
                    }
                    if memory_data.get('sourceArtifactId'):
                        firestore_doc['sourceArtifactId'] = memory_data[
                            'sourceArtifactId']
                    if memory_data.get('sourceArtifactTitle'):
                        firestore_doc['sourceArtifactTitle'] = memory_data[
                            'sourceArtifactTitle']
                    if memory_data.get('sourceBrandId'):
                        firestore_doc['sourceBrandId'] = memory_data[
                            'sourceBrandId']
                    if memory_data.get('insightElementType'):
                        firestore_doc['insightElementType'] = memory_data[
                            'insightElementType']

                    db.collection(collection_path).document(
                        entity_id).collection('memories').add(firestore_doc)
                    added_count += 1
        else:
            # No agent engine, just save to Firestore
            for memory_item in memories:
                memory_data = extract_memory_data(memory_item)
                firestore_doc = {
                    'content': memory_data['content'],
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'updatedAt': firestore.SERVER_TIMESTAMP,
                    'source': 'brand_soul_insight'
                }
                if memory_data.get('sourceArtifactId'):
                    firestore_doc['sourceArtifactId'] = memory_data[
                        'sourceArtifactId']
                if memory_data.get('sourceArtifactTitle'):
                    firestore_doc['sourceArtifactTitle'] = memory_data[
                        'sourceArtifactTitle']
                if memory_data.get('sourceBrandId'):
                    firestore_doc['sourceBrandId'] = memory_data[
                        'sourceBrandId']
                if memory_data.get('insightElementType'):
                    firestore_doc['insightElementType'] = memory_data[
                        'insightElementType']

                db.collection(collection_path).document(entity_id).collection(
                    'memories').add(firestore_doc)
                added_count += 1

        return JSONResponse(content={
            "status": "success",
            "added": added_count,
            "errors": errors if errors else None
        },
                            status_code=200)

    except Exception as e:
        logger.error(f"Error bulk adding memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/memories/check-artifacts")
async def check_artifact_memories(request: Request):
    """
    Checks which artifacts have memories saved in a memory bank.

    Body params:
    - user_id: Required for personal type
    - brand_id: Required for team type
    - type: 'personal' or 'team' (defaults to 'personal')
    - artifact_ids: List of artifact IDs to check

    Returns:
    - artifact_status: Dict mapping artifact_id -> boolean (true if has memories)
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        brand_id = data.get('brand_id')
        memory_type = data.get('type', 'personal')
        artifact_ids = data.get('artifact_ids', [])

        if not artifact_ids:
            return JSONResponse(content={
                "status": "success",
                "artifact_status": {}
            },
                                status_code=200)

        # Validate required params
        if memory_type == 'team':
            if not brand_id:
                raise HTTPException(
                    status_code=400,
                    detail="brand_id is required for team memories")
            entity_id = brand_id
            collection_path = 'brands'
        else:
            if not user_id:
                raise HTTPException(
                    status_code=400,
                    detail="user_id is required for personal memories")
            entity_id = user_id
            collection_path = 'users'

        db = firestore.client()

        # Query memories to find which artifacts have saved memories
        memories_ref = db.collection(collection_path).document(
            entity_id).collection('memories')

        # Get all unique sourceArtifactIds from memories
        artifact_status = {}

        # Initialize all requested artifacts as not saved
        for artifact_id in artifact_ids:
            artifact_status[artifact_id] = False

        # Query for memories with sourceArtifactId in the requested list
        # Firestore doesn't support 'in' queries with more than 10 items,
        # so we need to batch or query all and filter
        query = memories_ref.where('sourceArtifactId', '>=',
                                   '').select(['sourceArtifactId'])
        docs = query.stream()

        for doc in docs:
            doc_data = doc.to_dict()
            source_id = doc_data.get('sourceArtifactId')
            if source_id and source_id in artifact_status:
                artifact_status[source_id] = True

        return JSONResponse(content={
            "status": "success",
            "artifact_status": artifact_status
        },
                            status_code=200)

    except Exception as e:
        logger.error(f"Error checking artifact memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/memories/delete-by-artifact")
async def delete_memories_by_artifact(request: Request):
    """
    Deletes all memories that came from a specific source artifact.

    Body params:
    - user_id: Required for personal type
    - brand_id: Required for team type
    - type: 'personal' or 'team' (defaults to 'personal')
    - source_artifact_id: The artifact ID to delete memories for
    """
    try:
        data = await request.json()
        user_id = data.get('user_id')
        brand_id = data.get('brand_id')
        memory_type = data.get('type', 'personal')
        source_artifact_id = data.get('source_artifact_id')

        if not source_artifact_id:
            raise HTTPException(status_code=400,
                                detail="source_artifact_id is required")

        # Validate required params
        if memory_type == 'team':
            if not brand_id:
                raise HTTPException(
                    status_code=400,
                    detail="brand_id is required for team memories")
            entity_id = brand_id
            collection_path = 'brands'
            engine_id_field = 'teamAgentEngineId'
        else:
            if not user_id:
                raise HTTPException(
                    status_code=400,
                    detail="user_id is required for personal memories")
            entity_id = user_id
            collection_path = 'users'
            engine_id_field = 'agentEngineId'

        db = firestore.client()
        doc = db.collection(collection_path).document(entity_id).get()

        if not doc.exists:
            return JSONResponse(content={
                "status": "success",
                "deleted": 0,
                "message": "Entity not found"
            },
                                status_code=200)

        agent_engine_id = doc.to_dict().get(engine_id_field)

        # Query memories by sourceArtifactId
        memories_ref = db.collection(collection_path).document(
            entity_id).collection('memories')
        query = memories_ref.where('sourceArtifactId', '==',
                                   source_artifact_id)
        matching_docs = list(query.stream())

        if not matching_docs:
            return JSONResponse(content={
                "status":
                "success",
                "deleted":
                0,
                "message":
                "No memories found for this artifact"
            },
                                status_code=200)

        deleted_count = 0
        vertex_deleted_count = 0
        errors = []

        # Build a set of content strings from Firestore docs to match against Vertex AI
        content_to_delete = set()
        for fs_doc in matching_docs:
            doc_data = fs_doc.to_dict()
            content = doc_data.get('content')
            if content:
                content_to_delete.add(content)

        # Delete from Vertex AI if possible
        if agent_engine_id:
            try:
                # Use vertexai.Client (same as ADK notebook approach for saving)
                import vertexai
                settings = get_settings()
                project_id = settings.effective_project_id
                location = settings.agent_engine_location

                logger.info(f"Initializing vertexai for deleting memories by artifact: project={project_id}, location={location}, engine_id={agent_engine_id}")

                # Initialize vertexai client (same as ADK notebook)
                vertexai.init(project=project_id, location=location)
                client = vertexai.Client(project=project_id, location=location)

                logger.info(f"Created vertexai.Client: type={type(client).__name__}, has agent_engines={hasattr(client, 'agent_engines')}")

                agent_engine_name = f'projects/{project_id}/locations/{location}/reasoningEngines/{agent_engine_id}'

                # List all memories from Vertex AI and match by content
                try:
                    logger.info(f"Listing memories from Vertex AI: {agent_engine_name}")
                    memories_list = client.agent_engines.memories.list(
                        name=agent_engine_name)
                    for memory in memories_list:
                        memory_content = getattr(memory, 'fact', None)
                        if memory_content and memory_content in content_to_delete:
                            try:
                                logger.info(f"Deleting memory from Vertex AI: {memory.name}")
                                client.agent_engines.memories.delete(
                                    name=memory.name)
                                vertex_deleted_count += 1
                                logger.info(
                                    f"Deleted memory from Vertex AI: {memory.name}"
                                )
                            except Exception as delete_e:
                                logger.error(
                                    f"Failed to delete memory {memory.name} from Vertex AI: {delete_e}"
                                )
                                import traceback
                                logger.error(traceback.format_exc())
                                errors.append(
                                    f"Vertex AI delete failed for {memory.name}: {str(delete_e)}"
                                )
                except Exception as list_e:
                    logger.warning(
                        f"Failed to list memories from Vertex AI: {list_e}")
                    errors.append(
                        f"Failed to list Vertex AI memories: {str(list_e)}")

            except Exception as vertex_e:
                logger.warning(
                    f"Failed to initialize Vertex AI: {vertex_e}. Deleting from Firestore only."
                )
                errors.append(f"Vertex AI init failed: {str(vertex_e)}")

        # Delete from Firestore
        for fs_doc in matching_docs:
            fs_doc.reference.delete()
            deleted_count += 1

        logger.info(
            f"Deleted {deleted_count} memories from Firestore and {vertex_deleted_count} from Vertex AI for artifact {source_artifact_id}"
        )

        return JSONResponse(content={
            "status": "success",
            "deleted": deleted_count,
            "vertex_deleted": vertex_deleted_count,
            "errors": errors if errors else None
        },
                            status_code=200)

    except Exception as e:
        logger.error(f"Error deleting memories by artifact: {e}")
        raise HTTPException(status_code=500, detail=str(e))
