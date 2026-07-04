import {
  BadgeDollarSign,
  BrainCircuit,
  Boxes,
  ChartColumnBig,
  CircleOff,
  ClipboardCheck,
  Cpu,
  Database,
  FileSearch,
  FlaskConical,
  Gavel,
  HardHat,
  Leaf,
  Lightbulb,
  Microscope,
  Network,
  Radar,
  Scale,
  Shield,
  ShieldAlert,
  Swords,
  Target,
  TriangleAlert,
  Wrench,
  UserRound,
} from "lucide-react";

export const agentAvatarVariantOptions = [
  { value: "empty", label: "Без иконки" },
  { value: "attacker", label: "Атакующий" },
  { value: "defender", label: "Защитник" },
  { value: "ecology", label: "Экология" },
  { value: "finance", label: "Финансы" },
  { value: "manufacturer", label: "Производство" },
  { value: "patent", label: "Патенты" },
  { value: "risk", label: "Риски" },
  { value: "safety", label: "Безопасность" },
  { value: "scaling", label: "Масштабирование" },
  { value: "research", label: "Исследования" },
  { value: "quality", label: "Качество" },
  { value: "legal", label: "Право" },
  { value: "engineering", label: "Инжиниринг" },
  { value: "data", label: "Данные" },
  { value: "strategy", label: "Стратегия" },
  { value: "operations", label: "Операции" },
  { value: "innovation", label: "Идеи" },
  { value: "systems", label: "Системы" },
  { value: "materials", label: "Материалы" },
  { value: "diagnostics", label: "Диагностика" },
  { value: "validation", label: "Валидация" },
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
  research: Microscope,
  quality: ClipboardCheck,
  legal: Scale,
  engineering: Wrench,
  data: Database,
  strategy: Target,
  operations: Boxes,
  innovation: Lightbulb,
  systems: Network,
  materials: FlaskConical,
  diagnostics: Radar,
  validation: Cpu,
};

export function AgentVariantIcon({ variant, className = "", strokeWidth = 2 }) {
  const Icon = variant === "empty" ? CircleOff : accessoryByVariant[variant] ?? BrainCircuit;

  return <Icon className={className} aria-hidden="true" strokeWidth={strokeWidth} />;
}

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
