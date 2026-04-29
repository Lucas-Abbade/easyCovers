from pydantic import BaseModel
from typing import Optional

class UserCredentials(BaseModel):
    email: str
    password: str
    username: Optional[str] = None

    
class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    instrument: Optional[str] = None
    favorite_genres: Optional[str] = None
    favorite_artists: Optional[str] = None