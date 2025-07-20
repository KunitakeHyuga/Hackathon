from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    name: str
    age: int

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None

class User(UserBase):
    id: int

    class Config:
        from_attributes = True

class HistoryBase(BaseModel):
    user_input: str
    bot_output: str
    dialect: str
    direction: str

class HistoryCreate(HistoryBase):
    conversation_id: int

class History(HistoryBase):
    id: int
    created_at: datetime
    conversation_id: int

    class Config:
        from_attributes = True

class ConversationBase(BaseModel):
    title: str | None = None

class ConversationCreate(ConversationBase):
    pass

class Conversation(ConversationBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True
