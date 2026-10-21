import { useState } from "react";
import { capiboraMessage } from "./capiboraVoice";
import { Plus } from "lucide-react";
import type { PhraseTreatment } from "./phrasePreferences";
function OfficialArt({ group = false }: { group?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={`${import.meta.env.BASE_URL}${group ? "images/web/capi-group.webp" : "mascot/web/capi-sosa.webp"}`}
      alt=""
      aria-hidden="true"
      width={group ? 200 : 320}
      height={group ? 150 : 240}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
export function GroupArtwork() {
  return <OfficialArt group />;
}
export default function ArenaGroupBanner({
  treatment,
  onCreate,
}: {
  treatment?: PhraseTreatment;
  onCreate: () => void;
}) {
  const message = capiboraMessage("group-empty");
  return (
    <section
      className="arena-group-intro is-empty"
      aria-label="Treine em companhia"
    >
      <OfficialArt />
      <div>
        <h2>
          {treatment === "feminine"
            ? message.title.replace("sozinho", "sozinha")
            : message.title}
        </h2>
        <p>{message.body}</p>
      </div>
      <button className="primary-button group-create-cta" onClick={onCreate}>
        <Plus size={20} /> Criar grupo
      </button>
    </section>
  );
}
