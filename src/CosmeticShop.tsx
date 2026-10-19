import { useRef, useState } from "react";
import { Check, LockKeyhole } from "lucide-react";
import type { Cosmetic, GameState } from "./gamification";
import type { GameController } from "./useGamification";
import { bannerImage, frameImage, profileShopItem } from "./cosmetics";
import { deviceTimezone } from "./social";
import Modal from "./Modal";
import CapiWheyToken from "./CapiWheyToken";
import CapiWheyAmount from "./CapiWheyAmount";
import { OperationSpinner } from "./SyncFeedback";

const CATEGORIES = [
  { id: "frame", name: "Molduras" },
  { id: "banner", name: "Banners" },
] as const;

/** Product artwork only: no composed profile or avatar simulation. */
export function CosmeticPreview({
  item,
  onReady,
}: {
  item: Pick<Cosmetic, "id" | "category" | "name">;
  onReady?: (id: string, ready: boolean) => void;
}) {
  const src =
    item.category === "frame" ? frameImage(item.id) : bannerImage(item.id);
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span className={`cosmetic-preview preview-${item.category}`}>
      {src && failed !== src ? (
        <img
          className="shop-cosmetic-art"
          src={src}
          alt={`Prévia de ${item.name}`}
          decoding="async"
          onLoad={() => onReady?.(item.id, true)}
          onError={() => {
            setFailed(src);
            onReady?.(item.id, false);
          }}
        />
      ) : (
        <small className="cosmetic-missing">Imagem em breve</small>
      )}
    </span>
  );
}

export default function CosmeticShop({
  game,
  balance,
  onChanged,
}: {
  game: GameController;
  balance: number;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [available, setAvailable] = useState<Record<string, boolean>>({});
  const submitting = useRef(false);
  const raw = game.state?.cosmetics;
  if (!raw) return null;
  const items = raw.filter((i) => profileShopItem(i.id, i.category));
  const detail = items.find((i) => i.id === selected);
  const busy = game.busy || pending;
  const ready = (id: string, value: boolean) =>
    setAvailable((prev) =>
      prev[id] === value ? prev : { ...prev, [id]: value },
    );
  async function act(item: Cosmetic, buy = false) {
    if (
      submitting.current ||
      game.busy ||
      item.locked ||
      (buy && (item.owned || balance < item.price || !available[item.id])) ||
      (!buy && !item.equipped && !available[item.id])
    )
      return;
    submitting.current = true;
    setPending(true);
    setNotice("");
    try {
      const ok = await game.act(buy ? "buy_cosmetic" : "equip_cosmetic", {
        p_item: !buy && item.equipped ? null : item.id,
        ...(!buy ? { p_category: item.category } : {}),
        p_timezone: deviceTimezone(),
      });
      if (ok) {
        setNotice(
          buy
            ? "Compra concluída"
            : item.equipped
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
  const disabled = (item: Cosmetic) =>
    busy ||
    item.locked ||
    (!item.equipped && !available[item.id]) ||
    (!item.owned && balance < item.price);
  return (
    <section className="cosmetic-shop profile-shop" aria-label="Personalização">
      {CATEGORIES.filter(({ id }) =>
        items.some((item) => item.category === id),
      ).map(({ id, name }) => (
        <section
          className="shop-category"
          key={id}
          aria-labelledby={`shop-${id}-heading`}
        >
          <h2 id={`shop-${id}-heading`}>{name}</h2>
          <div className="cosmetic-grid">
            {items
              .filter((i) => i.category === id)
              .map((item) => (
                <article
                  key={item.id}
                  className={`cosmetic-item ${item.equipped ? "is-equipped" : ""}`}
                  aria-label={item.name}
                >
                  <button
                    type="button"
                    className="product-preview-button"
                    aria-label={`Ver ${item.name}`}
                    onClick={() => {
                      setSelected(item.id);
                      setNotice("");
                    }}
                  >
                    <CosmeticPreview
                      key={item.id}
                      item={item}
                      onReady={ready}
                    />
                    {item.equipped && (
                      <span className="product-equipped">
                        <Check size={14} />
                        <span className="sr-only">Usando</span>
                      </span>
                    )}
                  </button>
                  <strong>{item.name}</strong>
                  <span className="product-price">
                    {item.locked ? (
                      <>
                        <LockKeyhole size={14} />
                        Bloqueado
                      </>
                    ) : item.owned ? (
                      <>
                        <Check size={14} />
                        Comprado
                      </>
                    ) : (
                      <>
                        <CapiWheyAmount amount={item.price} />
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    className={item.owned ? "outline-button" : "primary-button"}
                    disabled={disabled(item)}
                    aria-label={`${item.locked ? "Bloqueado:" : item.equipped ? "Usando" : item.owned ? "Equipar" : "Comprar"} ${item.name}`}
                    onClick={() =>
                      item.owned ? void act(item) : setSelected(item.id)
                    }
                  >
                    {item.locked ? (
                      "Bloqueado"
                    ) : item.equipped ? (
                      "Usando"
                    ) : item.owned ? (
                      "Equipar"
                    ) : (
                      <CapiWheyToken />
                    )}
                  </button>
                </article>
              ))}
          </div>
        </section>
      ))}
      {!items.length && (
        <p className="field-hint">
          O novo catálogo estará disponível após a atualização da Loja
        </p>
      )}
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
          title={detail.name}
          compactHeader
          onClose={() => {
            if (!submitting.current) setSelected(null);
          }}
        >
          <div className="product-detail">
            <CosmeticPreview key={detail.id} item={detail} onReady={ready} />
            {!detail.owned && (
              <p className="product-detail-price">
                <CapiWheyAmount amount={detail.price} />
              </p>
            )}
            {!available[detail.id] && (
              <p className="field-hint">
                A imagem oficial ainda não está disponível
              </p>
            )}
            {!detail.owned && balance < detail.price && (
              <p className="field-hint">
                Faltam <CapiWheyAmount amount={detail.price - balance} />
              </p>
            )}
            {detail.locked && <p className="field-hint">Item bloqueado</p>}
            {game.error && (
              <p role="alert" className="form-error">
                {game.error}
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
            <button
              className="primary-button"
              disabled={disabled(detail)}
              onClick={() => void act(detail, !detail.owned)}
            >
              <OperationSpinner active={pending} />
              {detail.owned
                ? detail.equipped
                  ? "Desequipar"
                  : "Equipar"
                : "Confirmar compra"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

export function equippedItem(state: GameState | null, category: string) {
  return state?.cosmetics?.find(
    (i) =>
      i.category === category &&
      i.equipped &&
      (category !== "frame" || profileShopItem(i.id, category)),
  )?.id;
}
