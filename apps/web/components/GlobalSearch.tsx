"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import api, { setAuthToken } from "../lib/api";

interface Suggestion {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  icon: string;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const router = useRouter();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) setAuthToken(token);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
        setResults(null);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
        setResults(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setResults(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/search/suggestions?q=${encodeURIComponent(query)}`);
        setSuggestions(res.data.suggestions || []);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query || query.length < 2) return;

    setLoading(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(query)}&limit=20`);
      setResults(res.data);
      setSuggestions([]);
    } catch (err) {
      console.error("Error searching:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleSuggestionClick(suggestion: Suggestion) {
    setQuery(suggestion.title);
    setIsOpen(false);
    
    switch (suggestion.type) {
      case "category":
        router.push(`/categories`);
        break;
      case "account":
        router.push(`/accounts`);
        break;
      case "tag":
        router.push(`/tags`);
        break;
      case "description":
        router.push(`/transactions?search=${encodeURIComponent(suggestion.id)}`);
        break;
    }
  }

  function handleResultClick(type: string, id: string) {
    setIsOpen(false);
    setQuery("");
    setResults(null);
    
    switch (type) {
      case "transaction":
        router.push(`/transactions`);
        break;
      case "category":
        router.push(`/categories`);
        break;
      case "account":
        router.push(`/accounts`);
        break;
      case "tag":
        router.push(`/tags`);
        break;
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: "8px 16px",
          background: "#f0f0f0",
          border: "2px solid #e0e0e0",
          borderRadius: "8px",
          fontSize: "14px",
          color: "#666",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          minWidth: "200px",
          justifyContent: "space-between"
        }}
      >
        <span>🔍 Buscar...</span>
        <span style={{ fontSize: "11px", opacity: 0.6 }}>
          {navigator.platform.includes("Mac") ? "⌘K" : "Ctrl+K"}
        </span>
      </button>
    );
  }

  return (
    <div
      ref={searchRef}
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "90%",
        maxWidth: "600px",
        background: "white",
        borderRadius: "16px",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        zIndex: 1000,
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <form onSubmit={handleSearch} style={{ padding: "16px", borderBottom: "1px solid #e0e0e0" }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar transacciones, categorías, cuentas, tags..."
          style={{
            width: "100%",
            padding: "12px 16px",
            border: "2px solid #667eea",
            borderRadius: "8px",
            fontSize: "16px",
            outline: "none"
          }}
          autoFocus
        />
      </form>

      <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
        {loading && (
          <div style={{ padding: "20px", textAlign: "center", color: "#666" }}>
            Buscando...
          </div>
        )}

        {!loading && results && (
          <div style={{ padding: "16px" }}>
            {results.transactions && results.transactions.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#666" }}>
                  Transacciones ({results.transactions.length})
                </h3>
                {results.transactions.map((tx: any) => (
                  <div
                    key={tx.id}
                    onClick={() => handleResultClick("transaction", tx.id)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      marginBottom: "8px",
                      background: "#f8f9fa",
                      border: "1px solid #e0e0e0",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#e9ecef"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#f8f9fa"}
                  >
                    <div style={{ fontWeight: "600", marginBottom: "4px" }}>
                      {tx.description || "Sin descripción"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      {tx.category?.name} • {tx.account?.name} • {new Date(tx.occurredAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {results.categories && results.categories.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#666" }}>
                  Categorías ({results.categories.length})
                </h3>
                {results.categories.map((cat: any) => (
                  <div
                    key={cat.id}
                    onClick={() => handleResultClick("category", cat.id)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      marginBottom: "8px",
                      background: "#f8f9fa",
                      border: "1px solid #e0e0e0"
                    }}
                  >
                    {cat.icon} {cat.name}
                  </div>
                ))}
              </div>
            )}

            {results.accounts && results.accounts.length > 0 && (
              <div style={{ marginBottom: "24px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#666" }}>
                  Cuentas ({results.accounts.length})
                </h3>
                {results.accounts.map((acc: any) => (
                  <div
                    key={acc.id}
                    onClick={() => handleResultClick("account", acc.id)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      marginBottom: "8px",
                      background: "#f8f9fa",
                      border: "1px solid #e0e0e0"
                    }}
                  >
                    💳 {acc.name}
                  </div>
                ))}
              </div>
            )}

            {results.tags && results.tags.length > 0 && (
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "12px", color: "#666" }}>
                  Tags ({results.tags.length})
                </h3>
                {results.tags.map((tag: any) => (
                  <div
                    key={tag.id}
                    onClick={() => handleResultClick("tag", tag.id)}
                    style={{
                      padding: "12px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      marginBottom: "8px",
                      background: "#f8f9fa",
                      border: "1px solid #e0e0e0"
                    }}
                  >
                    🏷️ {tag.name}
                  </div>
                ))}
              </div>
            )}

            {results.transactions?.length === 0 && 
             results.categories?.length === 0 && 
             results.accounts?.length === 0 && 
             results.tags?.length === 0 && (
              <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
                No se encontraron resultados
              </div>
            )}
          </div>
        )}

        {!loading && !results && suggestions.length > 0 && (
          <div style={{ padding: "16px" }}>
            <div style={{ fontSize: "12px", color: "#999", marginBottom: "12px" }}>
              Sugerencias
            </div>
            {suggestions.map((suggestion, i) => (
              <div
                key={i}
                onClick={() => handleSuggestionClick(suggestion)}
                style={{
                  padding: "12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  marginBottom: "8px",
                  background: "#f8f9fa",
                  border: "1px solid #e0e0e0",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#e9ecef"}
                onMouseLeave={(e) => e.currentTarget.style.background = "#f8f9fa"}
              >
                <span style={{ fontSize: "20px" }}>{suggestion.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600" }}>{suggestion.title}</div>
                  <div style={{ fontSize: "12px", color: "#666" }}>{suggestion.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !results && suggestions.length === 0 && query.length >= 2 && (
          <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
            Presiona Enter para buscar
          </div>
        )}
      </div>
    </div>
  );
}

