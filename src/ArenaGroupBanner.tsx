import { useState } from "react";
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
  return (
    <section
      className="arena-group-intro is-empty"
      aria-label="Treine em companhia"
    >
      <OfficialArt />
      <div>
        <h2>
          Não quer fazer isso {treatment === "feminine" ? "sozinha" : "sozinho"}
          ?
        </h2>
        <p>
          Crie seu grupo ou entre em um grupo com seus amigos. É muito mais
          fácil treinar com companhia...
        </p>
      </div>
      <button className="primary-button group-create-cta" onClick={onCreate}>
        <Plus size={20} /> Criar grupo
      </button>
    </section>
  );
}
