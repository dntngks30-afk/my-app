export type MovementTypeDescription = {
  title: string;
  summary: string;
  do: string[];
  dont: string[];
};

export const TYPE_DESCRIPTIONS: Record<string, MovementTypeDescription> = {};
