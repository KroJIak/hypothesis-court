function Accessory({ variant }) {
  const fill = "#e0e0e0";
  const stroke = "#232323";

  switch (variant) {
    case "defender":
      return (
        <>
          <circle cx="44" cy="43" r="8" fill="none" stroke={stroke} strokeWidth="2.5" />
          <circle cx="68" cy="43" r="8" fill="none" stroke={stroke} strokeWidth="2.5" />
          <path d="M52 43h8" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M33 43h4" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M75 43h4" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M42 82l14 8 14-8-14-4-14 4z" fill={fill} />
          <path d="M82 86c5 2 9 6 9 12-7 3-12 8-16 15-9-6-13-12-13-23 0-1 8-3 20-4z" fill={fill} />
        </>
      );
    case "attacker":
      return (
        <>
          <path d="M43 37l-10 4" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          <path d="M69 37l10 4" stroke={stroke} strokeWidth="3" strokeLinecap="round" />
          <circle cx="45" cy="47" r="2.8" fill={stroke} />
          <circle cx="67" cy="47" r="2.8" fill={stroke} />
          <path d="M54 56c4 2 8 2 12 0" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57 77h8v26h-8z" fill={fill} />
          <path d="M53 77h16l-8 10-8-10z" fill={fill} />
          <path d="M84 78l10 10-6 2 2 9-9 4 2-10-6-2 7-13z" fill={fill} />
        </>
      );
    case "manufacturer":
      return (
        <>
          <path d="M32 43h48c-2-13-13-22-24-22s-22 9-24 22z" fill={fill} />
          <path d="M43 21v22M56 18v25M69 21v22" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="79" cy="90" r="12" fill={fill} />
          <path
            d="M79 78v5M79 97v5M67 90h5M86 90h5M71 82l3 3M84 95l3 3M87 82l-3 3M74 95l-3 3"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      );
    case "finance":
      return (
        <>
          <circle cx="44" cy="43" r="8" fill="none" stroke={stroke} strokeWidth="2.5" />
          <circle cx="68" cy="43" r="8" fill="none" stroke={stroke} strokeWidth="2.5" />
          <path d="M52 43h8" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M33 43h4" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M75 43h4" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M57 77h8v26h-8z" fill={fill} />
          <path d="M53 77h16l-8 10-8-10z" fill={fill} />
          <rect x="77" y="78" width="18" height="22" rx="3" fill={fill} />
          <path d="M82 84h8M82 89h8M82 94h8M85 81v16" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </>
      );
    case "risk":
      return (
        <>
          <path d="M34 36c9-15 39-15 48 0-8 1-15 4-24 4s-16-3-24-4z" fill={fill} />
          <path d="M39 36l-6 10M77 36l6 10" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M57 77h8v26h-8z" fill={fill} />
          <path d="M53 77h16l-8 10-8-10z" fill={fill} />
          <path d="M86 82l10 17H76l10-17z" fill={fill} />
          <path d="M86 88v5M86 96h.01" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case "ecology":
      return (
        <>
          <circle cx="79" cy="90" r="12" fill={fill} />
          <path d="M73 92c8-14 16-14 12 1-5 4-9 5-12-1z" fill="none" stroke={stroke} strokeWidth="2.2" />
          <path d="M72 97c7-4 12-9 14-14" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />
        </>
      );
    case "scaling":
      return (
        <>
          <rect x="73" y="87" width="6" height="16" rx="2" fill={fill} />
          <rect x="82" y="79" width="6" height="24" rx="2" fill={fill} />
          <rect x="91" y="71" width="6" height="32" rx="2" fill={fill} />
        </>
      );
    case "safety":
      return (
        <>
          <path d="M86 80l11 19H75l11-19z" fill={fill} />
          <path d="M86 86v6M86 96h.01" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case "patent":
      return (
        <>
          <path d="M76 77h17l5 5v17H76z" fill={fill} />
          <path d="M93 77v7h7" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path d="M81 90h12M81 95h8" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case "judge":
      return (
        <>
          <circle cx="44" cy="43" r="8" fill="none" stroke={stroke} strokeWidth="2.5" />
          <circle cx="68" cy="43" r="8" fill="none" stroke={stroke} strokeWidth="2.5" />
          <path d="M52 43h8" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M33 43h4" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M75 43h4" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M79 79l15 15-5 5-15-15z" fill={fill} />
          <rect x="71" y="83" width="9" height="5" rx="1.5" transform="rotate(-45 71 83)" fill={fill} />
          <path d="M67 98l8-8 11 11-8 8z" fill={fill} />
        </>
      );
    default:
      return null;
  }
}

export function AgentAvatar({ variant, size = "regular" }) {
  return (
    <div className={`agent-avatar agent-avatar--${size}`}>
      <svg viewBox="0 0 112 112" aria-hidden="true">
        <rect x="0" y="0" width="112" height="112" rx="22" fill="#2c2c2c" />
        <circle cx="56" cy="35" r="22" fill="#d6d6d6" />
        <path
          d="M22 103c0-18 15-32 34-32s34 14 34 32"
          fill="#757575"
        />
        <Accessory variant={variant} />
      </svg>
    </div>
  );
}
