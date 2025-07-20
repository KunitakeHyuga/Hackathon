# モデルの定義
from sqlalchemy import Column, Integer, String, DateTime, func, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel
from app.database import Base
from app.database import ENGINE


# userテーブルのモデルUserTableを定義
class UserTable(Base):
    __tablename__ = 'user'
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(30), nullable=False)
    age = Column(Integer)


# POSTやPUTのとき受け取るRequest Bodyのモデルを定義
class User(BaseModel):
    id: int
    name: str
    age: int


# 会話（セッション）テーブル
class ConversationTable(Base):
    __tablename__ = 'conversation'
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    histories = relationship("HistoryTable", back_populates="conversation")

# 方言対話履歴テーブルのモデル
class HistoryTable(Base):
    __tablename__ = 'history'
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_input = Column(String(255), nullable=False)
    bot_output = Column(String(255), nullable=False)
    dialect = Column(String(30), nullable=False)
    direction = Column(String(30), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    conversation_id = Column(Integer, ForeignKey('conversation.id'), nullable=False)
    conversation = relationship("ConversationTable", back_populates="histories")


def main():
    # テーブルが存在しなければ、テーブルを作成
    Base.metadata.create_all(bind=ENGINE)


if __name__ == "__main__":
    main()
