import { ChevronDown, CircleHelp } from "lucide-react";

export default function AboutApp() {
  return (
    <details className="settings-about help-content">
      <summary>
        <h2><CircleHelp size={19} aria-hidden="true" /> Sobre o app</h2>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <p>Capibora é um aplicativo para organizar seus treinos, acompanhar sua ofensiva e participar de desafios com amigos.</p>
    </details>
  );
}
