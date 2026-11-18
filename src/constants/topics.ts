export interface TopicItem {
  code: string;
  label: string;
  icon: string;
}

export const TOPICS: readonly TopicItem[] = [
  { code: 'WORK', label: 'Công việc & Văn phòng', icon: '💼' },
  { code: 'TRAVEL', label: 'Du lịch & Di chuyển', icon: '✈️' },
  { code: 'ACADEMIC', label: 'Học thuật & Giáo dục', icon: '🎓' },
  { code: 'TECHNOLOGY', label: 'Công nghệ', icon: '💻' },
  { code: 'HEALTH', label: 'Sức khỏe', icon: '🏥' },
  { code: 'FOOD', label: 'Ăn uống', icon: '🍜' },
  { code: 'MONEY', label: 'Mua sắm & Tiền bạc', icon: '💰' },
  { code: 'FAMILY', label: 'Gia đình & Bạn bè', icon: '👨‍👩‍👧' },
  { code: 'SPORTS', label: 'Thể thao & Giải trí', icon: '⚽' },
  { code: 'ENVIRONMENT', label: 'Môi trường', icon: '🌱' },
  { code: 'SOCIETY', label: 'Xã hội & Pháp luật', icon: '🏛️' },
  { code: 'ARTS', label: 'Nghệ thuật & Văn hóa', icon: '🎨' },
] as const;

export const TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  TOPICS.map((t) => [t.code, t.label])
);

export const TOPIC_ICONS: Record<string, string> = Object.fromEntries(
  TOPICS.map((t) => [t.code, t.icon])
);

// Backward compatibility alias for existing components importing TOPIC_MAP
export const TOPIC_MAP = TOPIC_LABELS;

// Options list including "All topics" for filter dropdowns
export const TOPIC_FILTER_OPTIONS = [
  { code: 'ALL', label: 'Tất cả chủ đề', icon: '📚' },
  ...TOPICS,
];
