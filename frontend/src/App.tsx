import React, { useState, useRef, useEffect } from "react";
import { Send, ArrowLeftRight, Globe } from "lucide-react";

// 方言の型定義
const dialects = [
  "北海道弁",
  "東北弁（津軽弁）",
  "関西弁",
  "広島弁",
  "博多弁",
  "沖縄弁",
  "佐賀弁",
] as const;
type Dialect = (typeof dialects)[number];
type TranslationDirection = "standard-to-dialect" | "dialect-to-standard";

interface Message {
  id: number;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
  dialect?: Dialect;
  direction?: TranslationDirection;
}

// 履歴型
interface HistoryItem {
  id: number;
  user_input: string;
  bot_output: string;
  dialect: string;
  direction: string;
  created_at: string;
}

// 会話型
interface ConversationItem {
  id: number;
  title: string | null;
  created_at: string;
}

const GEMINI_API_KEY = "AIzaSyD_snLOn01KVqN784ttg9g7vcsjgyXlR-8"; // 🔑 ← ここにあなたのAPIキーを入力してください

const DialectTranslator: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [selectedDialect, setSelectedDialect] = useState<Dialect>("関西弁");
  const [translationDirection, setTranslationDirection] =
    useState<TranslationDirection>("standard-to-dialect");
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<HistoryItem | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 履歴取得
  useEffect(() => {
    fetch("http://localhost:8000/history")
      .then((res) => res.json())
      .then((data) => setHistory(data))
      .catch(() => setHistory([]));
  }, []);

  // 会話一覧取得
  useEffect(() => {
    fetch("http://localhost:8000/conversations")
      .then((res) => res.json())
      .then((data) => setConversations(data))
      .catch(() => setConversations([]));
  }, []);

  // 会話選択時にその会話の履歴を取得
  useEffect(() => {
    if (selectedConversation) {
      const url = `http://localhost:8000/history?conversation_id=${selectedConversation.id}`;
      console.log('履歴取得URL:', url, 'conversation_id:', selectedConversation.id);
      fetch(url)
        .then((res) => res.json())
        .then((data) => setHistory(data))
        .catch(() => setHistory([]));
    }
  }, [selectedConversation]);

  // 履歴クリック時に内容をチャット欄に表示
  useEffect(() => {
    if (selectedHistory) {
      setMessages([
        {
          id: Date.now(),
          type: "user",
          content: selectedHistory.user_input,
          timestamp: new Date(selectedHistory.created_at),
        },
        {
          id: Date.now() + 1,
          type: "bot",
          content: selectedHistory.bot_output,
          dialect: selectedHistory.dialect as Dialect,
          direction: selectedHistory.direction as TranslationDirection,
          timestamp: new Date(selectedHistory.created_at),
        },
      ]);
    }
  }, [selectedHistory]);

  const callGeminiAPI = async (
    text: string,
    dialect: Dialect,
    direction: TranslationDirection
  ): Promise<string> => {
    const directionText =
      direction === "standard-to-dialect"
        ? "以下の標準語を指定の方言に翻訳してください。"
        : "以下の方言を標準語に翻訳してください。";

    const prompt = `${directionText}
方言: ${dialect}
テキスト: "${text}"
翻訳結果のみを簡潔に返してください。`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`API Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("翻訳結果が取得できませんでした。");
    }

    return content.trim();
  };

  // 新規会話作成＋タイトルリネームをまとめた関数
  const createConversationWithTitle = async (): Promise<number> => {
    // 新規会話作成
    const res = await fetch("http://localhost:8000/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新しい会話" }),
    });
    const newConv = await res.json();
    setConversations((prev) => [newConv, ...prev]);
    setSelectedConversation(newConv);
    // タイトルリネーム
    const newTitle = window.prompt("会話のタイトルを入力してください", "");
    if (newTitle && newTitle.trim() !== "") {
      await fetch(`http://localhost:8000/conversations/${newConv.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      // 会話一覧を再取得
      const convRes = await fetch("http://localhost:8000/conversations");
      const convData = await convRes.json();
      setConversations(convData);
    }
    return newConv.id;
  };

  const handleTranslate = async (): Promise<void> => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      type: "user",
      content: inputText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTranslating(true);

    try {
      // 会話IDの決定（新規なら作成＋タイトルリネーム）
      let conversationId: number;
      if (!selectedConversation) {
        // 新規会話作成
        const res = await fetch("http://localhost:8000/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "新しい会話" }),
        });
        const newConv = await res.json();
        console.log('新規会話作成結果:', newConv);
        setConversations((prev) => [newConv, ...prev]);
        setSelectedConversation(newConv);
        conversationId = newConv.id; // ← これを必ず使う
        console.log('新規会話ID:', conversationId);
      } else {
        conversationId = selectedConversation.id;
        console.log('既存会話ID:', conversationId);
      }

      // 翻訳API呼び出し
      const translatedText = await callGeminiAPI(
        inputText,
        selectedDialect,
        translationDirection
      );

      const botMessage: Message = {
        id: Date.now() + 1,
        type: "bot",
        content: translatedText,
        dialect: selectedDialect,
        direction: translationDirection,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);

      // conversationIdで履歴保存
      console.log('履歴保存時 conversation_id:', conversationId);
      const historyPayload = {
        user_input: inputText,
        bot_output: translatedText,
        dialect: selectedDialect,
        direction: translationDirection,
        conversation_id: conversationId,
      };
      console.log('履歴保存ペイロード:', historyPayload);
      const postRes = await fetch("http://localhost:8000/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(historyPayload),
      });
      console.log('履歴保存POST:', postRes.status);

      // 保存後に履歴を再取得
      const getRes = await fetch(`http://localhost:8000/history?conversation_id=${conversationId}`);
      const data = await getRes.json();
      console.log('履歴取得GET:', data);
      setHistory(data);
    } catch (error) {
      console.error("Translation error:", error);
      const errorMessage: Message = {
        id: Date.now() + 2,
        type: "bot",
        content: "翻訳に失敗しました。もう一度お試しください。",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTranslate();
    }
  };

  // 新規会話作成
  const handleCreateConversation = async () => {
    const res = await fetch("http://localhost:8000/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新しい会話" }),
    });
    if (res.ok) {
      const newConv = await res.json();
      setConversations((prev) => [newConv, ...prev]);
      setSelectedConversation(newConv);
    }
  };

  // 会話タイトル編集
  const handleEditConversation = async (conversationId: number, currentTitle: string) => {
    const newTitle = window.prompt("会話のタイトルを入力してください", currentTitle || "");
    if (newTitle !== null && newTitle.trim() !== "") {
      try {
        const res = await fetch(`http://localhost:8000/conversations/${conversationId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
        if (res.ok) {
          // 会話一覧を更新
          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === conversationId ? { ...conv, title: newTitle } : conv
            )
          );
          // 選択中の会話も更新
          if (selectedConversation?.id === conversationId) {
            setSelectedConversation((prev) => prev ? { ...prev, title: newTitle } : null);
          }
        }
      } catch (error) {
        console.error("会話タイトル更新エラー:", error);
        alert("タイトルの更新に失敗しました。");
      }
    }
  };

  // 会話削除
  const handleDeleteConversation = async (conversationId: number) => {
    if (!window.confirm("この会話を削除しますか？関連する履歴も削除されます。")) {
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:8000/conversations/${conversationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // 会話一覧から削除
        setConversations((prev) => prev.filter((conv) => conv.id !== conversationId));
        
        // 削除された会話が選択中だった場合、選択を解除
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation(null);
          setHistory([]);
          setMessages([]);
        }
      } else {
        alert("会話の削除に失敗しました。");
      }
    } catch (error) {
      console.error("会話削除エラー:", error);
      alert("会話の削除に失敗しました。");
    }
  };

  // VOICEVOX音声読み上げ機能
  const handleSpeak = async (text: string, dialect: string) => {
    try {
      // ずんだもんのスピーカーID（VOICEVOXのずんだもんのID）
      const speakerId = 3; // ずんだもんのノーマルスタイルID
      
      console.log('VOICEVOX音声合成開始:', text);
      
      // バックエンドのVOICEVOX APIを呼び出し
      const response = await fetch('http://localhost:8000/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          speaker_id: speakerId
        }),
      });
      
      if (!response.ok) {
        throw new Error(`VOICEVOX API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Base64デコードして音声データを取得
      const audioData = atob(data.audio);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      
      // 音声を再生
      const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.play();
      
      // ずんだもんらしいセリフを追加
      const zundaMessage: Message = {
        id: Date.now(),
        type: "bot",
        content: `ずんだもんです！「${text}」を${dialect}で読み上げました〜！`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, zundaMessage]);
      
      console.log('VOICEVOX音声合成完了');
      
    } catch (error) {
      console.error('VOICEVOX音声合成エラー:', error);
      alert('音声合成に失敗しました。VOICEVOXが起動しているか確認してください。');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white font-sans flex flex-col justify-start">
      {/* 会話一覧パネルを画面の一番左端に固定表示 */}
      <div className="hidden md:block" style={{position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 60, width: '20rem', background: 'rgba(30,41,59,0.7)', borderRight: '1px solid #fff3', padding: '1.5rem 1rem', overflowY: 'auto'}}>
        <div className="font-bold mb-2 text-lg text-cyan-300 flex items-center justify-between">
          会話一覧
          <button onClick={handleCreateConversation} className="bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-bold ml-2 shadow hover:bg-cyan-600 transition">＋新規</button>
        </div>
        {conversations.length === 0 && <div className="text-gray-400 text-sm">会話がありません</div>}
        <ul className="space-y-2 mb-6">
          {conversations.map((conv) => (
            <li
              key={conv.id}
              className={`p-2 rounded-lg hover:bg-cyan-900/30 relative group ${selectedConversation?.id === conv.id ? "bg-cyan-800/40" : ""}`}
            >
              <div 
                className="cursor-pointer pr-16"
                onClick={() => setSelectedConversation(conv)}
              >
                <div className="truncate text-sm font-semibold">{conv.title || `会話 #${conv.id}`}</div>
                <div className="text-xs text-gray-500">{new Date(conv.created_at).toLocaleString()}</div>
              </div>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-60 transition-opacity duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditConversation(conv.id, conv.title || "");
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded transition-colors"
                  title="タイトルを編集"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConversation(conv.id);
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white p-1.5 rounded transition-colors"
                  title="会話を削除"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
        {/* 選択中の会話の履歴 */}
        <div className="font-bold mb-2 text-cyan-300">履歴</div>
        {history.length === 0 && <div className="text-gray-400 text-sm">履歴がありません</div>}
        <ul className="space-y-2">
          {history.map((item) => (
            <li
              key={item.id}
              className={`p-2 rounded-lg hover:bg-cyan-900/30 relative group ${selectedHistory?.id === item.id ? "bg-cyan-800/40" : ""}`}
            >
              <div 
                className="cursor-pointer pr-12"
                onClick={() => setSelectedHistory(item)}
              >
                <div className="truncate text-sm font-semibold">{item.user_input}</div>
                <div className="text-xs text-gray-400">{item.dialect}・{item.direction === "standard-to-dialect" ? "標準語→方言" : "方言→標準語"}</div>
                <div className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString()}</div>
              </div>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity duration-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSpeak(item.bot_output, item.dialect);
                  }}
                  className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded transition-colors"
                  title="ずんだもんが読み上げる"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {/* メインコンテンツ */}
      <div className="container mx-auto px-4 py-2 max-w-4xl w-4/5 relative flex flex-row">
        <div className="flex-1">
          {/* メインコンテンツ全体 */}
          <div className="text-center mb-8 mt-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Globe className="w-8 h-8 text-cyan-400" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
                方言翻訳アプリ「どげんこつ」
              </h1>
            </div>
            <p className="text-gray-300 text-lg mb-4">日本全国の方言を楽しく学ぼう</p>
          </div>

          {/* 上部の半透明ボックス */}
          <div className="flex flex-row items-center mb-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 flex-1">
              <div className="flex flex-col md:flex-row items-center gap-4">
                <select
                  value={selectedDialect}
                  onChange={(e) => setSelectedDialect(e.target.value as Dialect)}
                  className="bg-white/20 text-white rounded-lg px-4 py-2 border border-white/30"
                >
                  {dialects.map((d) => (
                    <option key={d} value={d} className="bg-gray-800">
                      {d}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() =>
                    setTranslationDirection((prev) =>
                      prev === "standard-to-dialect"
                        ? "dialect-to-standard"
                        : "standard-to-dialect"
                    )
                  }
                  className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-4 py-2 rounded-lg"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  {translationDirection === "standard-to-dialect"
                    ? "標準語→方言"
                    : "方言→標準語"}
                </button>
              </div>
            </div>
          </div>

          {/* チャットエリア全体とずんだもん画像を横並びにする */}
          <div className="flex flex-row items-end gap-8">
            {/* チャットエリア（応答＋入力欄） */}
            <div className="flex-1 flex flex-col">
              <div className="bg-white/10 rounded-2xl border border-white/20 mb-6">
                <div className="h-[32rem] overflow-y-auto p-6 space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.type === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-xs md:max-w-md px-4 py-3 rounded-2xl relative group ${
                          msg.type === "user"
                            ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                            : "bg-white/20 text-white border border-white/30"
                        }`}
                      >
                        <p className="text-sm pr-8">{msg.content}</p>
                        {msg.type === "bot" && (
                          <div className="text-xs mt-2 opacity-60">
                            {msg.dialect} •{" "}
                            {msg.direction === "standard-to-dialect"
                              ? "標準語→方言"
                              : "方言→標準語"}
                          </div>
                        )}
                        {msg.type === "bot" && (
                          <button
                            onClick={() => handleSpeak(msg.content, msg.dialect || "標準語")}
                            className="absolute top-2 right-2 bg-green-500 hover:bg-green-600 text-white p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="ずんだもんが読み上げる"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {isTranslating && (
                    <div className="text-white">翻訳中...</div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              {/* 入力欄 */}
              <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
                <div className="flex gap-3 items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="翻訳したいテキストを入力してください..."
                    className="flex-1 bg-white/20 text-white rounded-xl px-4 py-3 border border-white/30"
                    disabled={isTranslating}
                  />
                  <button
                    onClick={handleTranslate}
                    disabled={!inputText.trim() || isTranslating}
                    className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-3 rounded-xl"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="text-center mt-6 text-gray-400 text-sm mb-8">
                日本の方言文化を楽しく学びましょう 🗾
              </div>
            </div>
            <div className="hidden md:block" style={{position: 'fixed', right: '10vw', bottom: '32px', zIndex: 50}}>
              <img src="/zunda.webp" alt="ずんだもん" style={{height: '350px', width: 'auto'}} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DialectTranslator;
