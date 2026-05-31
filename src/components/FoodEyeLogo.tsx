interface FoodEyeLogoProps {
  size?: number
  className?: string
}

export default function FoodEyeLogo({ size = 48, className = '' }: FoodEyeLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* White round character body */}
      <circle cx="42" cy="44" r="36" fill="white" stroke="#e2e8f0" strokeWidth="2" />
      {/* Rosy cheeks */}
      <circle cx="28" cy="52" r="6" fill="#fca5a5" opacity="0.55" />
      <circle cx="56" cy="52" r="6" fill="#fca5a5" opacity="0.55" />
      {/* Eyes */}
      <circle cx="34" cy="41" r="5.5" fill="#1e40af" />
      <circle cx="50" cy="41" r="5.5" fill="#1e40af" />
      {/* Eye shine */}
      <circle cx="36" cy="39" r="1.8" fill="white" />
      <circle cx="52" cy="39" r="1.8" fill="white" />
      {/* Smile */}
      <path d="M 31 54 Q 42 63 53 54" stroke="#374151" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Blue magnifying glass handle */}
      <line x1="70" y1="71" x2="87" y2="88" stroke="#2563eb" strokeWidth="7" strokeLinecap="round" />
      {/* Magnifying glass ring */}
      <circle cx="63" cy="64" r="20" fill="rgba(219,234,254,0.45)" stroke="#2563eb" strokeWidth="5.5" />
    </svg>
  )
}
