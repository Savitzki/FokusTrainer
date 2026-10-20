import MedicalKitIcon from "./MedicalKitIcon";
import { formatDay } from "./model";
import type { KitProtection } from "./economy";

export default function AutomaticKitNotice({ notices, onDone }: {
  notices: KitProtection[];
  onDone: () => void;
}) {
  return (
    <div>
      <MedicalKitIcon size={48} />
      <p>
        {notices.length === 1
          ? "Usamos 1 Kit Médico automaticamente para proteger o dia sem treino registrado:"
          : `Usamos ${notices.length} Kits Médicos automaticamente para proteger os dias sem treino registrado:`}
      </p>
      <ul>
        {notices.map((notice) => (
          <li key={notice.id}>{formatDay(notice.day, { day: "numeric", month: "long" })}</li>
        ))}
      </ul>
      <p>A proteção mantém a ofensiva, sem acrescentar pontos ou CapiWhey.</p>
      <button className="primary-button form-submit" onClick={onDone}>Entendi</button>
    </div>
  );
}
