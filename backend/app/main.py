from fastapi import FastAPI, HTTPException
from typing import List
from starlette.middleware.cors import CORSMiddleware
from app.database import session
from app.models import UserTable
from app.schemas import User, UserCreate, UserUpdate, History, HistoryCreate, Conversation, ConversationCreate
from app.crud import get_users, get_user, create_user, update_user, delete_user, get_histories, create_history, get_conversations, create_conversation, get_histories_by_conversation, delete_conversation_by_id, update_conversation_by_id

app = FastAPI()

# CORSを回避するために設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI"}

# 全ユーザー取得
@app.get("/users", response_model=List[User])
def read_users():
    return get_users()

# 特定のユーザー取得
@app.get("/users/{user_id}", response_model=User)
def read_user(user_id: int):
    user = get_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ユーザー作成
@app.post("/users", response_model=User)
def create_new_user(user: UserCreate):
    return create_user(user)

# ユーザー更新
@app.put("/users/{user_id}", response_model=User)
def update_existing_user(user_id: int, user: UserUpdate):
    updated_user = update_user(user_id, user)
    if updated_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return updated_user

# ユーザー削除
@app.delete("/users/{user_id}")
def delete_existing_user(user_id: int):
    success = delete_user(user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# 会話一覧取得
@app.get("/conversations", response_model=List[Conversation])
def read_conversations():
    return get_conversations()

# 会話作成
@app.post("/conversations", response_model=Conversation)
def add_conversation(conversation: ConversationCreate):
    return create_conversation(conversation)

# 会話更新
@app.put("/conversations/{conversation_id}", response_model=Conversation)
def update_conversation(conversation_id: int, conversation: ConversationCreate):
    updated_conversation = update_conversation_by_id(conversation_id, conversation)
    if updated_conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return updated_conversation

# 会話削除
@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: int):
    success = delete_conversation_by_id(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"message": "Conversation deleted successfully"}

# 履歴取得（会話ID指定可）
@app.get("/history", response_model=List[History])
def read_histories(conversation_id: int = None):
    if conversation_id is not None:
        return get_histories_by_conversation(conversation_id)
    return get_histories()

# 履歴追加
@app.post("/history", response_model=History)
def add_history(history: HistoryCreate):
    return create_history(history)

# VOICEVOX音声合成
@app.post("/synthesize")
async def synthesize_speech(request: dict):
    print(f"Received request: {request}")  # デバッグログ
    text = request.get("text", "")
    speaker_id = request.get("speaker_id", 3)  # ずんだもんのデフォルトID
    print(f"Text: {text}, Speaker ID: {speaker_id}")  # デバッグログ
    
    import httpx
    
    # VOICEVOX APIのエンドポイント（統合されたDocker Composeサービス名でアクセス）
    VOICEVOX_URL = "http://voicevox:50021"
    
    try:
        print(f"Connecting to VOICEVOX at {VOICEVOX_URL}")  # デバッグログ
        # 音声合成のリクエスト
        async with httpx.AsyncClient() as client:
            # 音声合成クエリの作成
            print(f"Creating audio query for text: {text}")  # デバッグログ
            query_response = await client.post(
                f"{VOICEVOX_URL}/audio_query",
                params={"text": text, "speaker": speaker_id}
            )
            print(f"Query response status: {query_response.status_code}")  # デバッグログ
            query_response.raise_for_status()
            query_data = query_response.json()
            
            # 音声合成の実行
            print("Starting synthesis")  # デバッグログ
            synthesis_response = await client.post(
                f"{VOICEVOX_URL}/synthesis",
                params={"speaker": speaker_id},
                json=query_data
            )
            print(f"Synthesis response status: {synthesis_response.status_code}")  # デバッグログ
            synthesis_response.raise_for_status()
            
            # 音声データをBase64エンコードして返す
            import base64
            audio_base64 = base64.b64encode(synthesis_response.content).decode('utf-8')
            print(f"Audio data length: {len(audio_base64)}")  # デバッグログ
            
            return {
                "audio": audio_base64,
                "format": "wav"
            }
    except Exception as e:
        print(f"Error in synthesize_speech: {str(e)}")  # デバッグログ
        import traceback
        traceback.print_exc()  # スタックトレースを出力
        raise HTTPException(status_code=500, detail=f"VOICEVOX API error: {str(e)}")
