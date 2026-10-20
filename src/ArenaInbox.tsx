import { useEffect, useRef, useState } from "react";
import { Reply, X } from "lucide-react";
import { useArenaNotices } from "./useArenaNotices";
import Mascot from "./Mascot";
import Modal from "./Modal";

/** Global reply receipt; original provocations appear only while inside the Arena. */
export default function ArenaInbox({
  userId,
  inArena,
  blocked = false,
}: {
  userId: string;
  inArena: boolean;
  blocked?: boolean;
}) {
  const inbox = useArenaNotices(userId);
  const root = useRef<HTMLDivElement>(null);
  const [otherDialog, setOtherDialog] = useState(false);
  const reply = inbox.messages.find((m) => m.replyTo);
  const notice = inbox.messages.find((m) => !m.replyTo);
  // Defer this optional modal while registration/profile/system dialogs are open.
  useEffect(() => {
    if (!reply) return;
    const update = () =>
      setOtherDialog(
        [...document.querySelectorAll("dialog[open]")].some(
          (dialog) => !root.current?.contains(dialog),
        ),
      );
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    update();
    return () => observer.disconnect();
  }, [reply?.id]);
  return (
    <div ref={root}>
      {reply && !blocked && !otherDialog && (
        <Modal
          compactHeader
          centered
          dismissible={false}
          title={`@${reply.nickname} revidou`}
          onClose={() => inbox.dismiss(reply)}
        >
          <div className="arena-reply-notice">
            <Mascot pose={reply.pose} size={120} />
            <p>{reply.text}</p>
          </div>
        </Modal>
      )}
      {inArena && notice && !reply && !blocked && (
        <aside
          className="arena-taunt-notice"
          role="status"
          aria-label={`Provocação de ${notice.nickname}`}
        >
          <Mascot pose={notice.pose} size={48} />
          <div className="arena-taunt-copy">
            <strong>@{notice.nickname}</strong>
            <p>{notice.text}</p>
            {inbox.error && <small>{inbox.error}</small>}
          </div>
          {notice.canReply && (
            <button
              className="icon-button"
              aria-label={`Revidar provocação de ${notice.nickname}`}
              disabled={inbox.busy || Boolean(inbox.replying)}
              onClick={() => void inbox.reply(notice)}
            >
              <Reply size={20} aria-hidden="true" />
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Fechar provocação"
            disabled={Boolean(inbox.replying)}
            onClick={() => inbox.dismiss(notice)}
          >
            <X size={19} aria-hidden="true" />
          </button>
        </aside>
      )}
    </div>
  );
}
