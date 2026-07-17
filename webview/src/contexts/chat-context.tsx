import type { Dispatch, ReactNode } from 'react';
import { createContext, useContext, useMemo, useReducer } from 'react';
import type { Action, ChatState } from '../store';
import { initialState, reducer } from '../store';

type ChatContextValue = {
  state: ChatState;
  dispatch: Dispatch<Action>;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatCtx({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatState must be used within <ChatStateProvider>');
  }
  return ctx;
}

export function useChatState(): ChatState {
  return useChatContext().state;
}

export function useChatDispatch(): Dispatch<Action> {
  return useChatContext().dispatch;
}

export function useReady(): boolean {
  return useChatState().status.phase === 'ready';
}
