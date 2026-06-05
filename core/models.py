import json
from sqlalchemy import Column, String, Integer, Boolean, Text, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(String(50), primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(Integer, nullable=False) # Unix timestamp in ms
    status = Column(String(20), default="active") # active, suspended

    # 关联关系
    canvases = relationship("Canvas", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")

class Canvas(Base):
    __tablename__ = "canvases"

    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), default="未命名画布")
    data_json = Column(Text, nullable=False) # 保存 Canvas 的所有元素
    is_trash = Column(Boolean, default=False)
    deleted_at = Column(Integer, nullable=True) # Unix timestamp in ms
    updated_at = Column(Integer, nullable=False) # Unix timestamp in ms

    # 关联关系
    user = relationship("User", back_populates="canvases")

    @property
    def data(self):
        try:
            return json.loads(self.data_json) if self.data_json else {}
        except Exception:
            return {}

    @data.setter
    def data(self, value):
        self.data_json = json.dumps(value, ensure_ascii=False)

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String(50), primary_key=True, index=True)
    user_id = Column(String(50), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), default="新对话")
    messages_json = Column(Text, nullable=False) # 消息数组JSON
    updated_at = Column(Integer, nullable=False) # Unix timestamp in ms

    # 关联关系
    user = relationship("User", back_populates="conversations")

    @property
    def messages(self):
        try:
            return json.loads(self.messages_json) if self.messages_json else []
        except Exception:
            return []

    @messages.setter
    def messages(self, value):
        self.messages_json = json.dumps(value, ensure_ascii=False)
