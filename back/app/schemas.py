from pydantic import BaseModel
from typing import Optional

class UserCredentials(BaseModel):
    email: str
    password: str
    username: Optional[str] = None