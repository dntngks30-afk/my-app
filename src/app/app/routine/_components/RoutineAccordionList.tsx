'use client';

/**
 * RoutineAccordionList
 *
 * segments/items flatten → 3~4개 accordion 항목.
 */

import RoutineAccordionItem, { type RoutineAccordionItemData } from './RoutineAccordionItem';

type RoutineAccordionListProps = {
  items: RoutineAccordionItemData[];
  onRetry?: (templateId: string) => void;
};

export default function RoutineAccordionList({ items, onRetry }: RoutineAccordionListProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <RoutineAccordionItem key={item.id} item={item} onRetry={onRetry} />
      ))}
    </div>
  );
}
