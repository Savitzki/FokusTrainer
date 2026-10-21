import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Reply } from "lucide-react";
import { useArenaNotices } from "./useArenaNotices";
import Mascot from "./Mascot";
import Modal from "./Modal";
import { subscribeSync, syncVersion, syncWriting } from "./sync";

/** One authenticated, global queue for originals and replies. Never interrupts another dialog. */
type Props = { userId: string; blocked?: boolean };
export default function ArenaInbox(props: Props) {
  return <InboxQueue key={props.userId} {...props} />;
}
function InboxQueue({ userId, blocked = false }: Props) {
  const inbox = useArenaNotices(userId);
  useSyncExternalStore(subscribeSync, syncVersion);
  const writing = syncWriting(userId, "inbox");
  const root = useRef<HTMLDivElement>(null);
  const [otherDialog, setOtherDialog] = useState(true);
  const [selected, setSelected] = useState<string>();
  const notice =
    inbox.messages.find((m) => m.id === selected) ?? inbox.messages[0];
  useEffect(() => {
    setSelected(notice?.id);
  }, [notice?.id]);
  useEffect(() => {
    const update = () =>
      setOtherDialog(
        Boolean(document.querySelector('[data-critical-operation][aria-busy="true"]')) ||
        [...document.querySelectorAll("dialog[open]")].some(
          (dialog) => !root.current?.contains(dialog),
        ),
      );
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open", "aria-busy"],
    });
    update();
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root}>
      {notice && !blocked && !writing && !otherDialog && (
        <Modal
          key={notice.id}
          compactHeader
          centered
          dismissible={false}
          title={`@${notice.nickname} ${notice.replyTo ? "revidou!" : "te provocou!"}`}
          closeDisabled={inbox.busy || Boolean(inbox.replying)}
          onClose={() => inbox.dismiss(notice)}
        >
          <div className="arena-reply-notice">
            <Mascot pose={notice.pose} size={144} />
            <p>{notice.text}</p>
          </div>
          {inbox.error && (
            <p role="alert" className="form-error">
              {inbox.error}
            </p>
          )}
          <div className="form-actions arena-inbox-actions">
            <button
              className="outline-button"
              disabled={inbox.busy || Boolean(inbox.replying)}
              onClick={() => inbox.dismiss(notice)}
            >
              Fechar
            </button>
            {notice.canReply && !notice.replyTo && (
              <button
                className="primary-button"
                disabled={inbox.busy || Boolean(inbox.replying)}
                onClick={() => void inbox.reply(notice)}
              >
                <Reply size={18} aria-hidden="true" />{" "}
                {inbox.replying ? "Enviando…" : "Revidar"}
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
