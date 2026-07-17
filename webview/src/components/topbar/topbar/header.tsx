import { TopbarLeft } from '../topbar-left';
import { TopbarRight } from '../topbar-right';
import './header.scss';

export function Topbar() {
  return (
    <div className="topbar">
      <TopbarLeft />
      <TopbarRight />
    </div>
  );
}
