import os
import json
from threading import Lock
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import DATABASE_URL, now_ms
from core.models import Base, User, Canvas as CanvasModel, Conversation

# 数据库连接初始化
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 初始化表结构
def init_db():
    Base.metadata.create_all(bind=engine)
    # 创建默认用户
    db = SessionLocal()
    try:
        default_user = db.query(User).filter(User.id == "default_user").first()
        if not default_user:
            # 采用简单的 bcrypt 哈希防止循环引用
            import bcrypt
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw("default_password_change_me".encode('utf-8'), salt).decode('utf-8')
            default_user = User(
                id="default_user",
                email="default@opencanvas.local",
                hashed_password=hashed,
                created_at=now_ms(),
                status="active"
            )
            db.add(default_user)
            db.commit()
    except Exception as e:
        print(f"初始化默认用户失败: {e}")
    finally:
        db.close()

# 执行初始化
init_db()

# 并发控制锁 - 保持与旧代码的兼容性
QUEUE_LOCK = Lock()
HISTORY_LOCK = Lock()
GLOBAL_CONFIG_LOCK = Lock()
CONVERSATION_LOCK = Lock()
CANVAS_LOCK = Lock()
LOAD_LOCK = Lock()
RUNNINGHUB_WORKFLOW_LOCK = Lock()
UPDATE_LOCK = Lock()

def user_dir(user_id):
    # 保留此函数以防其他辅助模块引用，但实际存储在数据库中
    return user_id

def conversation_path(user_id, conversation_id):
    # 保留此函数作为标识符，但实际存储在数据库中
    return f"{user_id}/{conversation_id}"

def load_conversation(user_id, conversation_id):
    db = SessionLocal()
    try:
        conv = db.query(Conversation).filter(
            Conversation.user_id == user_id,
            Conversation.id == conversation_id
        ).first()
        if not conv:
            raise HTTPException(status_code=404, detail="对话不存在")
        return {
            "id": conv.id,
            "title": conv.title,
            "messages": conv.messages,
            "updated_at": conv.updated_at
        }
    finally:
        db.close()

def save_conversation(user_id, conversation):
    db = SessionLocal()
    try:
        conv = db.query(Conversation).filter(
            Conversation.user_id == user_id,
            Conversation.id == conversation["id"]
        ).first()
        if not conv:
            conv = Conversation(
                id=conversation["id"],
                user_id=user_id,
                title=conversation.get("title", "新对话"),
                messages_json=json.dumps(conversation.get("messages", []), ensure_ascii=False),
                updated_at=now_ms()
            )
            db.add(conv)
        else:
            conv.messages_json = json.dumps(conversation.get("messages", []), ensure_ascii=False)
            conv.title = conversation.get("title", conv.title)
            conv.updated_at = now_ms()
        db.commit()
    finally:
        db.close()

def canvas_path(canvas_id):
    return canvas_id

def load_canvas(canvas_id):
    db = SessionLocal()
    try:
        canvas = db.query(CanvasModel).filter(CanvasModel.id == canvas_id).first()
        if not canvas:
            raise HTTPException(status_code=404, detail="画布不存在")
        if canvas.is_trash:
            raise HTTPException(status_code=404, detail="画布已在回收站")
        return {
            "id": canvas.id,
            "user_id": canvas.user_id,
            "title": canvas.title,
            "data": canvas.data,
            "is_trash": canvas.is_trash,
            "deleted_at": canvas.deleted_at,
            "updated_at": canvas.updated_at
        }
    finally:
        db.close()

def load_canvas_any(canvas_id):
    db = SessionLocal()
    try:
        canvas = db.query(CanvasModel).filter(CanvasModel.id == canvas_id).first()
        if not canvas:
            raise HTTPException(status_code=404, detail="画布不存在")
        return {
            "id": canvas.id,
            "user_id": canvas.user_id,
            "title": canvas.title,
            "data": canvas.data,
            "is_trash": canvas.is_trash,
            "deleted_at": canvas.deleted_at,
            "updated_at": canvas.updated_at
        }
    finally:
        db.close()

def save_canvas(canvas):
    db = SessionLocal()
    try:
        c = db.query(CanvasModel).filter(CanvasModel.id == canvas["id"]).first()
        user_id = canvas.get("user_id", "default_user")
        if not c:
            c = CanvasModel(
                id=canvas["id"],
                user_id=user_id,
                title=canvas.get("title", "未命名画布"),
                data_json=json.dumps(canvas.get("data", {}), ensure_ascii=False),
                is_trash=canvas.get("is_trash", False),
                deleted_at=canvas.get("deleted_at"),
                updated_at=now_ms()
            )
            db.add(c)
        else:
            c.title = canvas.get("title", c.title)
            c.data_json = json.dumps(canvas.get("data", {}), ensure_ascii=False)
            c.is_trash = canvas.get("is_trash", c.is_trash)
            c.deleted_at = canvas.get("deleted_at", c.deleted_at)
            c.updated_at = now_ms()
            if "user_id" in canvas:
                c.user_id = canvas["user_id"]
        db.commit()
    finally:
        db.close()
