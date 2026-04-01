import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface OpenAiSessionContextValue {
  openAiApiKey: string | null;
  hasSessionApiKey: boolean;
  setSessionApiKey: (apiKey: string) => void;
  clearSessionApiKey: () => void;
}

const OpenAiSessionContext = createContext<OpenAiSessionContextValue | undefined>(undefined);

export function OpenAiSessionProvider({ children }: { children: ReactNode }) {
  const [openAiApiKey, setOpenAiApiKeyState] = useState<string | null>(null);

  const value = useMemo<OpenAiSessionContextValue>(
    () => ({
      openAiApiKey,
      hasSessionApiKey: Boolean(openAiApiKey),
      setSessionApiKey: (apiKey: string) => {
        const normalized = apiKey.trim();
        setOpenAiApiKeyState(normalized.length > 0 ? normalized : null);
      },
      clearSessionApiKey: () => {
        setOpenAiApiKeyState(null);
      },
    }),
    [openAiApiKey],
  );

  return <OpenAiSessionContext.Provider value={value}>{children}</OpenAiSessionContext.Provider>;
}

export function useOpenAiSession() {
  const context = useContext(OpenAiSessionContext);
  if (!context) {
    throw new Error("useOpenAiSession must be used within an OpenAiSessionProvider");
  }
  return context;
}
