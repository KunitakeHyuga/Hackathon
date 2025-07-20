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
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || "";


const DialectTranslator: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [selectedDialect, setSelectedDialect] = useState<Dialect>("関西弁");
  const [translationDirection, setTranslationDirection] =
    useState<TranslationDirection>("standard-to-dialect");
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white font-sans">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Globe className="w-8 h-8 text-cyan-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-pink-400 bg-clip-text text-transparent">
              方言トランスレーター
            </h1>
          </div>
          <p className="text-gray-300 text-lg">日本全国の方言を楽しく学ぼう</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
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

        <div className="bg-white/10 rounded-2xl border border-white/20 mb-6">
          <div className="h-96 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.type === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs md:max-w-md px-4 py-3 rounded-2xl ${
                    msg.type === "user"
                      ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                      : "bg-white/20 text-white border border-white/30"
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  {msg.type === "bot" && (
                    <div className="text-xs mt-2 opacity-60">
                      {msg.dialect} •{" "}
                      {msg.direction === "standard-to-dialect"
                        ? "標準語→方言"
                        : "方言→標準語"}
                    </div>
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

        <div className="bg-white/10 rounded-2xl p-4 border border-white/20">
          <div className="flex gap-3">
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

        <div className="text-center mt-6 text-gray-400 text-sm">
          日本の方言文化を楽しく学びましょう 🗾
        </div>
      </div>
    </div>
  );
};

export default DialectTranslator;
