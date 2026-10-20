import { useState } from "react";
import type { PhraseTreatment } from "./phrasePreferences";

/** Official artwork only; group data is presented once, in the list below. */
export default function ArenaGroupBanner({
  hasGroup,
  treatment,
}: {
  hasGroup: boolean;
  treatment?: PhraseTreatment;
}) {
  const source = `${import.meta.env.BASE_URL}${hasGroup ? "images/web/capi-group.webp" : "mascot/web/capi-sosa.webp"}`;
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <section
      className={`arena-group-intro ${hasGroup ? "has-group" : "is-empty"}`}
      aria-label={hasGroup ? "Seu time na Arena" : "Treine em companhia"}
    >
      {failed !== source && (
        <img
          src={source}
          alt=""
          aria-hidden="true"
          width={320}
          height={240}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(source)}
        />
      )}
      {!hasGroup && (
        <div>
          <h2>
            Não quer fazer isso{" "}
            {treatment === "feminine" ? "sozinha" : "sozinho"}?
          </h2>
          <p>
            Crie seu grupo ou entre em um grupo com seus amigos. É muito mais
            fácil treinar com companhia...
          </p>
        </div>
      )}
    </section>
  );
}
