import {
  BadgeDollarSign,
  ChartColumnBig,
  FileSearch,
  Gavel,
  HardHat,
  Leaf,
  Shield,
  ShieldAlert,
  Swords,
  TriangleAlert,
  UserRound,
} from "lucide-react";

export const agentAvatarVariantOptions = [
  { value: "attacker", label: "Атакующий" },
  { value: "defender", label: "Защитник" },
  { value: "ecology", label: "Экология" },
  { value: "finance", label: "Финансы" },
  { value: "manufacturer", label: "Производство" },
  { value: "patent", label: "Патенты" },
  { value: "risk", label: "Риски" },
  { value: "safety", label: "Безопасность" },
  { value: "scaling", label: "Масштабирование" },
];

export const accessoryByVariant = {
  attacker: Swords,
  defender: Shield,
  ecology: Leaf,
  empty: null,
  finance: BadgeDollarSign,
  judge: Gavel,
  manufacturer: HardHat,
  patent: FileSearch,
  risk: TriangleAlert,
  safety: ShieldAlert,
  scaling: ChartColumnBig,
};

export function AgentAvatar({ variant, size = "regular" }) {
  const AccessoryIcon = accessoryByVariant[variant] ?? null;

  return (
    <div className={`agent-avatar agent-avatar--${size}`}>
      <div className="agent-avatar__plate">
        <UserRound className="agent-avatar__base-icon" aria-hidden="true" strokeWidth={1.3} />
        {AccessoryIcon ? (
          <span className="agent-avatar__accessory" aria-hidden="true">
            <AccessoryIcon className="agent-avatar__accessory-icon" strokeWidth={2.05} />
          </span>
        ) : null}
      </div>
    </div>
  );
}
