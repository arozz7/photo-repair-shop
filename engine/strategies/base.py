from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BaseStrategy(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the strategy"""
        pass
        
    @property
    @abstractmethod
    def requires_reference(self) -> bool:
        """Does it need a reference file?"""
        pass
        
    @abstractmethod
    def can_repair(self, analysis_result: Dict[str, Any]) -> bool:
        """Given an analysis result, check if this strategy applies."""
        pass
        
    @abstractmethod
    def repair(self, input_path: str, output_path: str, reference_path: Optional[str] = None) -> Dict[str, Any]:
        """Perform the actual repair logic. Should return a dictionary with results."""
        pass
