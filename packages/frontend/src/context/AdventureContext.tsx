import { createContext, useContext, useState, type ReactNode } from 'react';

interface Value {
  adventureId: number | null;
  setAdventureId: (id: number | null) => void;
}

const Ctx = createContext<Value>({ adventureId: null, setAdventureId: () => {} });

export function AdventureProvider({ children }: { children: ReactNode }) {
  const [adventureId, setAdventureId] = useState<number | null>(null);
  return <Ctx.Provider value={{ adventureId, setAdventureId }}>{children}</Ctx.Provider>;
}

export function useCurrentAdventure() {
  return useContext(Ctx);
}
