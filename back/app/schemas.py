from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserCredentials(BaseModel):
    email: str
    password: str
    username: Optional[str] = None

class AuthResponse(BaseModel):
    status: str
    id: int
    email: str
    username: Optional[str] = None
    profile_picture_url: Optional[str] = None
    is_profile_completed: bool = False
    is_email_verified: bool = False

class VerifyEmailRequest(BaseModel):
    email: str
    code: str

class ResendVerificationRequest(BaseModel):
    email: str

class VerificationStatusResponse(BaseModel):
    status: str
    message: str
    email: Optional[str] = None
    resend_cooldown: Optional[int] = None

class PracticeMarker(BaseModel):
    id: str
    name: str
    start: float
    end: float
    color: Optional[str] = None

class UpdateMarkersRequest(BaseModel):
    markers: List[PracticeMarker]

class SongSummary(BaseModel):
    id: int
    name: str
    artist: Optional[str] = None
    genre: Optional[str] = None
    instrument: Optional[str] = None
    cover_image_url: Optional[str] = None
    practice_markers: Optional[str] = "[]"


class SpotifyConnectionStatus(BaseModel):
    connected: bool = False
    spotify_id: Optional[str] = ""
    display_name: Optional[str] = ""
    email: Optional[str] = ""
    avatar_url: Optional[str] = ""
    profile_url: Optional[str] = ""
    connected_at: Optional[datetime] = None

class UserProfileResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: Optional[str] = ""
    bio: Optional[str] = ""
    instrument: Optional[str] = ""
    favorite_genres: Optional[str] = ""
    favorite_artists: Optional[str] = ""
    profile_picture_url: Optional[str] = ""
    banner_picture_url: Optional[str] = ""
    location: Optional[str] = ""
    experience_level: Optional[str] = ""
    social_instagram: Optional[str] = ""
    social_youtube: Optional[str] = ""
    social_spotify: Optional[str] = ""
    social_x: Optional[str] = ""
    is_profile_completed: bool = False
    is_email_verified: bool = False
    created_at: Optional[datetime] = None
    songs_count: int = 0
    recent_songs: List[SongSummary] = []
    spotify_connection: Optional[SpotifyConnectionStatus] = None

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    instrument: Optional[str] = None
    favorite_genres: Optional[str] = None
    favorite_artists: Optional[str] = None
    location: Optional[str] = None
    experience_level: Optional[str] = None
    social_instagram: Optional[str] = None
    social_youtube: Optional[str] = None
    social_spotify: Optional[str] = None
    social_x: Optional[str] = None
