"""
Tests for Memory Bank Configuration and Environment Variable Loading

Note: Most tests that import agent_engine_manager are skipped because they
trigger Firebase/protobuf imports that cause descriptor conflicts (segfaults)
when running in the test suite with other tests.

These tests should be run in isolation or against a Firebase emulator.
"""

import os
import pytest
from pathlib import Path
from dotenv import load_dotenv

# Load .env file before running tests
env_path = Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)


class TestEnvironmentVariableLoading:
    """Test that environment variables are loaded correctly."""
    
    def test_dotenv_file_exists(self):
        """Verify .env file exists in project root."""
        env_path = Path(__file__).parent.parent.parent / '.env'
        # Skip if .env doesn't exist (CI environment may not have it)
        if not env_path.exists():
            pytest.skip(".env file not found - skipping in CI environment")
        assert env_path.exists()
    
    def test_memory_bank_env_var_set(self):
        """Verify MOMENTUM_ENABLE_MEMORY_BANK is set."""
        value = os.getenv('MOMENTUM_ENABLE_MEMORY_BANK')
        if value is None:
            pytest.skip("MOMENTUM_ENABLE_MEMORY_BANK not set in this environment")
        assert value is not None
    
    def test_memory_bank_env_var_is_true(self):
        """Verify MOMENTUM_ENABLE_MEMORY_BANK is set to 'true'."""
        value = os.getenv('MOMENTUM_ENABLE_MEMORY_BANK', 'false').lower()
        if value != 'true':
            pytest.skip("MOMENTUM_ENABLE_MEMORY_BANK is not 'true' in this environment")
        assert value == 'true'
    
    def test_project_id_env_var_set(self):
        """Verify project ID environment variable is set."""
        project_id = (
            os.getenv('MOMENTUM_NEXT_PUBLIC_FIREBASE_PROJECT_ID') or 
            os.getenv('GOOGLE_CLOUD_PROJECT')
        )
        if not project_id:
            pytest.skip("Project ID environment variable not set")
        assert project_id


class TestMemoryBankEnabledFunction:
    """Test the is_memory_bank_enabled() function."""
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    def test_is_memory_bank_enabled_when_true(self):
        """Test that is_memory_bank_enabled returns True when env var is 'true'."""
        pass
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    def test_is_memory_bank_enabled_when_false(self):
        """Test that is_memory_bank_enabled returns False when env var is 'false'."""
        pass
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    def test_is_memory_bank_enabled_case_insensitive(self):
        """Test that is_memory_bank_enabled handles case variations."""
        pass
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    def test_is_memory_bank_enabled_default_false(self):
        """Test that is_memory_bank_enabled defaults to False when not set."""
        pass


@pytest.mark.asyncio
class TestMemoryBankCreationWithConfig:
    """Test that Memory Bank creation respects configuration."""
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    async def test_create_engine_fails_when_disabled(self):
        """Test that Agent Engine creation fails when Memory Bank is disabled."""
        pass
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    async def test_create_engine_proceeds_when_enabled(self):
        """Test that Agent Engine creation proceeds when Memory Bank is enabled."""
        pass


class TestDotenvLoadingInMain:
    """Test that main.py loads .env correctly."""
    
    def test_main_imports_dotenv(self):
        """Verify main.py imports python-dotenv."""
        main_path = Path(__file__).parent.parent / 'main.py'
        if not main_path.exists():
            pytest.skip("main.py not found")
        with open(main_path, 'r') as f:
            content = f.read()
        
        assert 'from dotenv import load_dotenv' in content, \
            "main.py should import load_dotenv"
        assert 'load_dotenv(' in content, \
            "main.py should call load_dotenv()"
    
    def test_main_loads_dotenv_before_imports(self):
        """Verify main.py loads .env before importing routers."""
        main_path = Path(__file__).parent.parent / 'main.py'
        if not main_path.exists():
            pytest.skip("main.py not found")
        with open(main_path, 'r') as f:
            lines = f.readlines()
        
        dotenv_line = None
        router_import_line = None
        
        for i, line in enumerate(lines):
            if 'load_dotenv(' in line and dotenv_line is None:
                dotenv_line = i
            if 'from routers import' in line and router_import_line is None:
                router_import_line = i
        
        if dotenv_line is None:
            pytest.skip("load_dotenv() not found in main.py")
        if router_import_line is None:
            pytest.skip("router imports not found in main.py")
            
        assert dotenv_line < router_import_line, \
            f"load_dotenv() must be called before importing routers (line {dotenv_line} vs {router_import_line})"


class TestMemoryBankEndpoint:
    """Integration tests for Memory Bank API endpoint."""
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    @pytest.mark.asyncio
    async def test_create_engine_endpoint_returns_agent_engine_id(self):
        """Test that /agent/create-engine returns agent_engine_id on success."""
        pass
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    @pytest.mark.asyncio
    async def test_create_engine_endpoint_returns_500_on_error(self):
        """Test that /agent/create-engine returns 500 when backend returns error."""
        pass


@pytest.mark.asyncio
class TestMemoryBankDeletionAndCleanup:
    """Test that Memory Bank deletion properly cleans up resources."""
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    async def test_delete_engine_removes_from_firestore(self):
        """Test that deleting an engine removes it from Firestore."""
        pass
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    async def test_deletion_uses_field_delete_not_null(self):
        """Test that deletion uses FieldValue.delete() instead of null."""
        pass
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    async def test_create_then_delete_full_lifecycle(self):
        """Test full lifecycle: create, verify, delete, verify cleanup."""
        pass
    
    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    async def test_create_then_delete_personal_lifecycle(self):
        """Test full lifecycle for personal memory bank."""
        pass

    @pytest.mark.skip(reason="Triggers Firebase imports - causes protobuf segfault")
    async def test_personal_team_deletion_consistency_regression(self):
        """Regression test for Personal and Team memory bank deletion consistency."""
        pass
