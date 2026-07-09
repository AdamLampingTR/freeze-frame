import type { NotifyVia } from "../types";

export function NotifyMenu({ onNotify }: { onNotify: (via: NotifyVia) => void }) {
  return (
    <span className="notify-menu">
      Notify:
      <button onClick={() => onNotify("email")}>Email</button>
      <button onClick={() => onNotify("teams")}>Teams</button>
      <button onClick={() => onNotify("both")}>Both</button>
    </span>
  );
}
