import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { OutlineItem } from "@shared/lib/types";
import { cn } from "@shared/lib/utils";
import { useTranslation } from "react-i18next";

interface OutlineTreeProps {
  items: OutlineItem[];
  onPageSelect: (page: number) => void;
  currentPage: number;
}

export function OutlineTree({
  items,
  onPageSelect,
  currentPage,
}: OutlineTreeProps) {
  const { t } = useTranslation("reader");

  if (items.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground text-center">
        {t("noOutline")}
      </div>
    );
  }

  return (
    <div className="p-1">
      {items.map((item, i) => (
        <OutlineNode
          key={i}
          item={item}
          depth={0}
          onPageSelect={onPageSelect}
          currentPage={currentPage}
        />
      ))}
    </div>
  );
}

function OutlineNode({
  item,
  depth,
  onPageSelect,
  currentPage,
}: {
  item: OutlineItem;
  depth: number;
  onPageSelect: (page: number) => void;
  currentPage: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = item.children.length > 0;
  const isActive = item.page === currentPage;

  return (
    <div>
      <button
        className={cn(
          "flex items-center gap-1 w-full text-left px-2 py-1 rounded text-xs hover:bg-accent transition-colors",
          isActive && "bg-accent font-medium",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => {
          onPageSelect(item.page);
          if (hasChildren) setExpanded(!expanded);
        }}
      >
        {hasChildren && (
          <span className="shrink-0">
            {expanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </span>
        )}
        <span className="truncate flex-1">{item.title}</span>
        <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
          {item.page}
        </span>
      </button>
      {expanded &&
        hasChildren &&
        item.children.map((child, i) => (
          <OutlineNode
            key={i}
            item={child}
            depth={depth + 1}
            onPageSelect={onPageSelect}
            currentPage={currentPage}
          />
        ))}
    </div>
  );
}
