// IconMapper.tsx
// Maps text icon labels to emoji

export const ICON_MAP: Record<string, string> = {
  'TROPHY': '🏆',
  'TARGET': '🎯',
  'LIGHTNING': '⚡',
  'SHIELD': '🛡️',
  'UNLOCK': '🔓',
  'WARNING': '⚠️',
  'RELOAD': '🔄',
  'CROSS': '❌',
  'MUSCLE': '💪',
};

interface IconProps {
  label: string;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ label, className = '' }) => {
  const emoji = ICON_MAP[label] || label;
  return <span className={className}>{emoji}</span>;
};

// Alternative: Direct function export
export function getIcon(label: string): string {
  return ICON_MAP[label] || label;
}