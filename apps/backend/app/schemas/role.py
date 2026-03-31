from pydantic import BaseModel
from typing import List, Optional
from app.schemas.permission import PermissionOut

class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None

class RoleCreate(RoleBase):
    # optional list of permission codes to attach
    permission_codes: List[str] = []

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_codes: Optional[List[str]] = None

class RoleOut(RoleBase):
    id: int
    permissions: List[PermissionOut] = []

    class Config:
        orm_mode = True
