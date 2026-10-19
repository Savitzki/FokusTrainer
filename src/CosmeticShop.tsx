import Mascot from "./Mascot";
import { cosmeticDisplayName } from "./brand";
import { phraseText } from "./capiboraVoice";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Frame,
  Share2,
  Palette,
  Smile,
  LockKeyhole,
  X,
} from "lucide-react";
import type { Cosmetic, GameState } from "./gamification";
import type { GameController } from "./useGamification";
import type { Profile } from "./profile";
import { Avatar } from "./ProfilePanel";
import { EMOJIS, knownCosmetic, themeVariables } from "./cosmetics";
import { createShareImage, SHARE_MESSAGES } from "./sharing";
import { deviceTimezone } from "./social";
import { localDate } from "./model";
import Modal from "./Modal";
import ProteinToken from "./ProteinToken";
import { OperationSpinner } from "./SyncFeedback";

const CATEGORIES = [
  { id: "frame", name: "Molduras", Icon: Frame },
  { id: "share", name: "Cards", Icon: Share2 },
  { id: "theme", name: "Temas", Icon: Palette },
  { id: "emoji", name: "Emojis", Icon: Smile },
] as const;
export function CosmeticPreview({
  item,
  profile,
  days = 0,
  date = localDate(),
  frameId,
}: {
  item: Pick<Cosmetic, "id" | "category" | "name">;
  profile: Profile | null;
  days?: number;
  date?: string;
  frameId?: string;
}) {
  const [image, setImage] = useState<{ key: string; url: string } | null>(null),
    [error, setError] = useState(false);
  const key = JSON.stringify([item.id, profile, days, date, frameId]);
  useEffect(() => {
    if (item.category !== "share") return;
    let stopped = false,
      url: string | null = null;
    setError(false);
    void createShareImage({
      profile,
      days,
      date,
      styleId: item.id,
      format: "square",
      message: SHARE_MESSAGES[0],
      preview: true,
      previewSize: 320,
      ...(frameId ? { frameId } : {}),
    })
      .then((file) => {
        if (stopped) return;
        url = URL.createObjectURL(file);
        setImage({ key, url });
      })
      .catch(() => {
        if (!stopped) setError(true);
      });
    return () => {
      stopped = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, item.category]);
  return (
    <span className={`cosmetic-preview preview-${item.category}`}>
      {item.category === "frame" ? (
        <Avatar profile={profile} frame={item.id} size={50} />
      ) : item.category === "emoji" ? (
        <span className="emoji-art" aria-hidden="true">
          {EMOJIS[item.id]}
        </span>
      ) : item.category === "share" ? (
        image?.key === key ? (
          <img
            src={image.url}
            alt={`Prévia real de ${cosmeticDisplayName(item.name)}`}
            width={320}
            height={320}
          />
        ) : (
          <small>{error ? "Prévia indisponível" : "Gerando prévia…"}</small>
        )
      ) : (
        <span
          className="theme-preview-pair"
          aria-label={`Prévia clara e escura de ${cosmeticDisplayName(item.name)}`}
        >
          {(["dark", "light"] as const).map((mode) => (
            <span
              key={mode}
              className={`theme-mini theme-mini-${mode}`}
              style={themeVariables(item.id, mode)}
            >
              <span />
              <strong>Capibora</strong>
              <i />
              <b />
              <i />
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
export default function CosmeticShop({
  game,
  balance,
  onChanged,
  profile = null,
  days = 0,
  date = localDate(),
}: {
  game: GameController;
  balance: number;
  onChanged: () => void;
  profile?: Profile | null;
  days?: number;
  date?: string;
}) {
  const [category, setCategory] = useState<Cosmetic["category"]>("frame"),
    [selected, setSelected] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const raw = game.state?.cosmetics;
  if (!raw) return null;
  const classic: Cosmetic = {
    id: "classic",
    name: "Clássico",
    category: "share",
    price: 0,
    rarity: "common",
    badgeKey: null,
    owned: true,
    equipped: !raw.some((i) => i.category === "share" && i.equipped),
    locked: false,
  };
  const items = [
    ...raw.filter((i) => knownCosmetic(i.id, i.category)),
    classic,
  ];
  const categories = CATEGORIES.filter((c) =>
    items.some((i) => i.category === c.id),
  );
  const detail = items.find((i) => i.id === selected);
  const busy = game.busy || pending;
  const frameId = raw.find(
    (item) => item.category === "frame" && item.equipped,
  )?.id;
  const requirement = (item: Cosmetic) =>
    game.state?.achievements?.badges.find((b) => b.key === item.badgeKey)
      ?.name ?? "Uma conquista";
  async function act(item: Cosmetic, buy = false) {
    if (
      submitting.current ||
      game.busy ||
      item.locked ||
      (buy && (item.owned || balance < item.price))
    )
      return;
    submitting.current = true;
    setPending(true);
    setNotice("");
    try {
      const ok = buy
        ? await game.act("buy_cosmetic", {
            p_item: item.id,
            p_timezone: deviceTimezone(),
          })
        : await game.act("equip_cosmetic", {
            p_category: item.category,
            p_item: item.equipped || item.id === "classic" ? null : item.id,
            p_timezone: deviceTimezone(),
          });
      if (ok) {
        setNotice(
          buy
            ? `Compra concluída. ${phraseText("shop-purchased", 0, { purchaseConfirmed: true })}`
            : item.equipped && item.id !== "classic"
              ? "Item desequipado"
              : "Visual equipado",
        );
        onChanged();
        if (!buy) setSelected(null);
      }
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <section className="cosmetic-shop" aria-labelledby="cosmetic-heading">
      <h3 id="cosmetic-heading">Do seu jeito</h3>
      <div
        className="shop-categories"
        role="group"
        aria-label="Categorias da loja"
      >
        {categories.map(({ id, name, Icon }) => (
          <button
            type="button"
            key={id}
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
          >
            <Icon size={16} />
            {name}
          </button>
        ))}
      </div>
      <div className="cosmetic-grid">
        {items
          .filter((i) => i.category === category)
          .sort(
            (a, b) =>
              Number(b.equipped) - Number(a.equipped) ||
              Number(b.owned) - Number(a.owned) ||
              Number(a.locked) - Number(b.locked) ||
              a.price - b.price,
          )
          .map((item) => (
            <article
              key={item.id}
              className={`cosmetic-item ${item.equipped ? "is-equipped" : ""}`}
              aria-label={cosmeticDisplayName(item.name)}
            >
              <button
                className="product-preview-button"
                aria-label={`Ver ${cosmeticDisplayName(item.name)}`}
                onClick={() => setSelected(item.id)}
              >
                <CosmeticPreview
                  item={item}
                  profile={profile}
                  days={days}
                  date={date}
                  frameId={frameId}
                />
                {item.equipped && (
                  <span className="product-equipped">
                    <Check size={14} />
                    <span className="sr-only">Usando</span>
                  </span>
                )}
              </button>
              <strong>{cosmeticDisplayName(item.name)}</strong>
              <span className="product-price">
                {item.locked ? (
                  <>
                    <LockKeyhole size={13} />
                    {requirement(item)}
                  </>
                ) : item.owned ? (
                  <>
                    <Check size={13} />
                    {item.id === "classic" ? "Incluso" : "Comprado"}
                  </>
                ) : (
                  <>
                    <ProteinToken size={15} />
                    {item.price}
                  </>
                )}
              </span>
              <button
                type="button"
                className={item.owned ? "outline-button" : "primary-button"}
                disabled={
                  busy ||
                  item.locked ||
                  (!item.owned && balance < item.price) ||
                  (item.id === "classic" && item.equipped)
                }
                aria-label={
                  item.locked
                    ? `Bloqueado: ${cosmeticDisplayName(item.name)}`
                    : item.owned
                      ? `${item.equipped ? "Usando" : "Equipar"} ${cosmeticDisplayName(item.name)}`
                      : `Comprar ${cosmeticDisplayName(item.name)}`
                }
                onClick={() =>
                  item.owned ? void act(item) : setSelected(item.id)
                }
              >
                <OperationSpinner active={pending && selected === item.id} />
                {item.locked
                  ? "Bloqueado"
                  : item.equipped
                    ? "Usando"
                    : item.owned
                      ? "Equipar"
                      : "Comprar"}
              </button>
            </article>
          ))}
      </div>
      {notice && (
        <p className="economy-feedback" role="status">
          {notice}
        </p>
      )}
      {game.error && (
        <p role="alert" className="form-error">
          {game.error}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void game.refresh()}
          >
            Atualizar
          </button>
        </p>
      )}
      {detail && (
        <Modal
          title={cosmeticDisplayName(detail.name)}
          compactHeader
          onClose={() => {
            if (!submitting.current) setSelected(null);
          }}
        >
          <div className="product-detail">
            <CosmeticPreview
              item={detail}
              profile={profile}
              days={days}
              date={date}
              frameId={frameId}
            />
            <p>
              {detail.category === "emoji"
                ? "Reaja aos treinos confirmados de hoje nos seus grupos da Arena. Equipar escolhe seu favorito."
                : detail.category === "frame"
                  ? "Sua moldura no perfil, no topo do app e nos cards compartilhados."
                  : detail.category === "share"
                    ? "O mesmo visual será usado ao compartilhar sua ofensiva."
                    : "Novas cores de destaque, com modos claro e escuro preservados."}
            </p>
            {detail.locked ? (
              <p className="product-requirement">
                <LockKeyhole size={16} />
                {requirement(detail)}
              </p>
            ) : (
              !detail.owned && (
                <p className="product-detail-price">
                  <ProteinToken size={20} />
                  <strong>{detail.price}</strong> potes
                </p>
              )
            )}
            {!detail.owned && !detail.locked && balance < detail.price && (
              <p className="field-hint">
                Faltam {detail.price - balance} potes
              </p>
            )}
            {game.error && (
              <p className="form-error" role="alert">
                {game.error}
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
            {notice.startsWith("Compra concluída") && (
              <Mascot pose="happy" size={48} animate />
            )}
            <button
              className="primary-button"
              disabled={
                busy ||
                detail.locked ||
                (!detail.owned && balance < detail.price)
              }
              onClick={() => void act(detail, !detail.owned)}
            >
              <OperationSpinner active={pending} />
              {detail.owned
                ? detail.equipped && detail.id !== "classic"
                  ? "Desequipar"
                  : "Equipar"
                : `Confirmar compra · ${detail.price}`}
            </button>
            <button
              className="text-button"
              disabled={pending}
              onClick={() => setSelected(null)}
            >
              <X size={16} /> Fechar
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
export function equippedItem(state: GameState | null, category: string) {
  return state?.cosmetics?.find((i) => i.category === category && i.equipped)
    ?.id;
}
