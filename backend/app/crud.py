# DBへの接続設定
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
from app.models import UserTable
from app.schemas import UserCreate, UserUpdate
from typing import List, Optional
from app.models import HistoryTable
from app.schemas import HistoryCreate
from app.models import ConversationTable
from app.schemas import ConversationCreate


# 接続したいDBの基本情報を設定
user_name = "user"
password = "password"
host = "mysql"  # docker-composeで定義したMySQLのサービス名
database_name = "db"

DATABASE = 'mysql://%s:%s@%s/%s?charset=utf8' % (
    user_name,
    password,
    host,
    database_name,
)

# DBとの接続
ENGINE = create_engine(
    DATABASE,
    echo=True
)

# Sessionの作成
session = scoped_session(
    # ORM実行時の設定。自動コミットするか、自動反映するか
    sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=ENGINE
    )
)

# modelで使用する
Base = declarative_base()
# DB接続用のセッションクラス、インスタンスが作成されると接続する
Base.query = session.query_property()

# CRUD操作の関数
def get_users() -> List[UserTable]:
    return session.query(UserTable).all()

def get_user(user_id: int) -> Optional[UserTable]:
    return session.query(UserTable).filter(UserTable.id == user_id).first()

def create_user(user: UserCreate) -> UserTable:
    db_user = UserTable(name=user.name, age=user.age)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user

def update_user(user_id: int, user: UserUpdate) -> Optional[UserTable]:
    db_user = session.query(UserTable).filter(UserTable.id == user_id).first()
    if db_user is None:
        return None
    
    if user.name is not None:
        db_user.name = user.name
    if user.age is not None:
        db_user.age = user.age
    
    session.commit()
    session.refresh(db_user)
    return db_user

def delete_user(user_id: int) -> bool:
    db_user = session.query(UserTable).filter(UserTable.id == user_id).first()
    if db_user is None:
        return False
    
    session.delete(db_user)
    session.commit()
    return True

# 履歴取得
def get_histories() -> List[HistoryTable]:
    return session.query(HistoryTable).order_by(HistoryTable.created_at.desc()).all()

# 履歴追加
def create_history(history: HistoryCreate) -> HistoryTable:
    db_history = HistoryTable(**history.dict())
    session.add(db_history)
    session.commit()
    session.refresh(db_history)
    return db_history

def get_conversations() -> List[ConversationTable]:
    return session.query(ConversationTable).order_by(ConversationTable.created_at.desc()).all()

def create_conversation(conversation: ConversationCreate) -> ConversationTable:
    db_conversation = ConversationTable(**conversation.dict())
    session.add(db_conversation)
    session.commit()
    session.refresh(db_conversation)
    return db_conversation

def update_conversation_by_id(conversation_id: int, conversation: ConversationCreate) -> Optional[ConversationTable]:
    try:
        db_conversation = session.query(ConversationTable).filter(ConversationTable.id == conversation_id).first()
        if db_conversation is None:
            return None
        
        if conversation.title is not None:
            db_conversation.title = conversation.title
        
        session.commit()
        session.refresh(db_conversation)
        return db_conversation
    except Exception as e:
        session.rollback()
        print(f"Error updating conversation: {e}")
        return None

def get_histories_by_conversation(conversation_id: int) -> List[HistoryTable]:
    return session.query(HistoryTable).filter(HistoryTable.conversation_id == conversation_id).order_by(HistoryTable.created_at.asc()).all()

def delete_conversation_by_id(conversation_id: int) -> bool:
    try:
        # 関連する履歴も削除
        session.query(HistoryTable).filter(HistoryTable.conversation_id == conversation_id).delete()
        
        # 会話を削除
        db_conversation = session.query(ConversationTable).filter(ConversationTable.id == conversation_id).first()
        if db_conversation is None:
            return False
        
        session.delete(db_conversation)
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        print(f"Error deleting conversation: {e}")
        return False
