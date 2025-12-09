"""
Custom exception classes for MOMENTUM Agent.

This module defines standardized exception classes used throughout the application
to provide clear error handling and better debugging capabilities.
"""

from typing import Optional, Dict, Any


class MomentumBaseException(Exception):
    """Base exception class for all MOMENTUM-specific exceptions."""
    
    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code or self.__class__.__name__.upper()
        self.details = details or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for API responses."""
        return {
            'error': self.error_code,
            'message': self.message,
            'details': self.details
        }


class ConfigurationError(MomentumBaseException):
    """Raised when there's a configuration or environment setup issue."""
    pass


class AuthenticationError(MomentumBaseException):
    """Raised when authentication fails or credentials are invalid."""
    pass


class AuthorizationError(MomentumBaseException):
    """Raised when user lacks permission for requested operation."""
    pass


class ValidationError(MomentumBaseException):
    """Raised when input data fails validation."""
    pass


class ServiceUnavailableError(MomentumBaseException):
    """Raised when an external service is unavailable or unreachable."""
    pass


class RateLimitError(MomentumBaseException):
    """Raised when API rate limits are exceeded."""
    pass


class ResourceNotFoundError(MomentumBaseException):
    """Raised when a requested resource cannot be found."""
    pass


class ResourceConflictError(MomentumBaseException):
    """Raised when there's a conflict with the current state of a resource."""
    pass


class ProcessingError(MomentumBaseException):
    """Raised when data processing fails."""
    pass


class MediaProcessingError(ProcessingError):
    """Raised when media processing (images, videos) fails."""
    pass


class SearchError(MomentumBaseException):
    """Raised when search operations fail."""
    pass


class MemoryError(MomentumBaseException):
    """Raised when memory bank operations fail."""
    pass


class AgentError(MomentumBaseException):
    """Raised when agent operations fail."""
    pass


class VisionAnalysisError(ProcessingError):
    """Raised when vision analysis fails."""
    pass


class IndexingError(MomentumBaseException):
    """Raised when search indexing operations fail."""
    pass


# Utility functions for exception handling
def handle_external_api_error(
    exception: Exception,
    service_name: str,
    operation: str,
    fallback_message: str = "External service error"
) -> MomentumBaseException:
    """
    Convert external API exceptions to standardized MOMENTUM exceptions.
    
    Args:
        exception: The original exception from external API
        service_name: Name of the external service
        operation: Operation that failed
        fallback_message: Default message if exception message is unclear
        
    Returns:
        MomentumBaseException: Standardized exception
    """
    error_message = str(exception) or fallback_message
    details = {
        'service': service_name,
        'operation': operation,
        'original_error': exception.__class__.__name__
    }
    
    # Map common external API errors to appropriate MOMENTUM exceptions
    error_str = error_message.lower()
    
    if 'authentication' in error_str or 'unauthorized' in error_str:
        return AuthenticationError(
            f"{service_name} authentication failed during {operation}",
            details=details
        )
    elif 'permission' in error_str or 'forbidden' in error_str:
        return AuthorizationError(
            f"Insufficient permissions for {service_name} {operation}",
            details=details
        )
    elif 'rate limit' in error_str or 'quota' in error_str:
        return RateLimitError(
            f"{service_name} rate limit exceeded during {operation}",
            details=details
        )
    elif 'not found' in error_str:
        return ResourceNotFoundError(
            f"Resource not found in {service_name} during {operation}",
            details=details
        )
    elif 'timeout' in error_str or 'unavailable' in error_str:
        return ServiceUnavailableError(
            f"{service_name} is unavailable for {operation}",
            details=details
        )
    else:
        return ProcessingError(
            f"{service_name} error during {operation}: {error_message}",
            details=details
        )