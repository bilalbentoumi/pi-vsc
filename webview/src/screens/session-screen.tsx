import { useState } from 'react';
import { InputBar } from '../components/input-bar';
import { Topbar } from '../components/topbar';
import { EntryList } from '../components/entry-list';

export function ChatScreen() {
  const [scrolledUp, setScrolledUp] = useState(false);
  return (
    <>
      <Topbar />
      <EntryList
        onScrollAtBottomChange={(atBottom) => setScrolledUp(!atBottom)}
      />
      <div
        className={`chat-input-wrap${scrolledUp ? ' chat-input-scrolled' : ''}`}>
        <InputBar />
      </div>
    </>
  );
}
