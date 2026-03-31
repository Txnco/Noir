from pydantic import BaseModel

class PermissionBase(BaseModel):
    code: str
    label: str | None = None

class PermissionCreate(PermissionBase):
    pass

class PermissionOut(PermissionBase):
    id: int
    
    class Config:
        orm_mode = True
