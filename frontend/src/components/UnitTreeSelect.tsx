import React, { useEffect, useMemo } from 'react';
import { Select } from './Select';
import { compareUnitSiblings } from '../constants/unitSort';

export interface UnitNode {
  _id: string;
  name: string;
  level: number;
  parentId: string | null;
  positions?: string[];
}

interface UnitTreeSelectProps {
  units: UnitNode[];
  value: string;
  onChange: (unitId: string) => void;
  disabled?: boolean;
  selectClassName?: string;
}

// Cascading Phòng/Ban -> Đại đội dropdowns, driven purely by a flat unit list.
// Caller is responsible for scoping `units` to whichever subtree should be
// selectable (full tree for master-admin, own branch only otherwise).
export const UnitTreeSelect: React.FC<UnitTreeSelectProps> = ({ units, value, onChange, disabled, selectClassName }) => {
  const byId = useMemo(() => new Map(units.map(u => [u._id, u])), [units]);

  const childrenOf = (parentId: string) =>
    units.filter(u => u.parentId === parentId).sort(compareUnitSiblings);

  const rootId = useMemo(() => {
    const roots = units.filter(u => !u.parentId || !byId.has(u.parentId));
    return roots.sort(compareUnitSiblings)[0]?._id || null;
  }, [units, byId]);

  // Walk down from the root, following the branch that leads to the current
  // `value`; where it doesn't (empty/invalid/different branch), default to
  // the first child at that level.
  const chain: string[] = [];
  if (rootId) {
    let currentParent: string | null = rootId;
    while (currentParent) {
      chain.push(currentParent);
      const kids = childrenOf(currentParent);
      if (kids.length === 0) break;

      let node = byId.get(value);
      let target: string | null = null;
      while (node) {
        if (node.parentId === currentParent) { target = node._id; break; }
        node = node.parentId ? byId.get(node.parentId) : undefined;
      }
      currentParent = target || kids[0]._id;
    }
  }

  const leafId = chain[chain.length - 1] || '';

  useEffect(() => {
    if (leafId && leafId !== value) {
      onChange(leafId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafId]);

  const handleLevelChange = (newId: string) => {
    // Selecting a node re-descends into its first child repeatedly until a leaf.
    let node: UnitNode | undefined = byId.get(newId);
    let finalId = newId;
    while (node) {
      const kids = childrenOf(node._id);
      if (kids.length === 0) break;
      finalId = kids[0]._id;
      node = kids[0];
    }
    onChange(finalId);
  };

  if (!rootId) {
    return (
      <p className="text-[10px] text-vpa-red uppercase tracking-wider">
        Chưa có dữ liệu đơn vị. Vui lòng liên hệ quản trị viên hệ thống.
      </p>
    );
  }

  const dropdowns = chain
    .map((parentId, idx) => {
      const options = childrenOf(parentId);
      if (options.length === 0) return null;
      const selected = chain[idx + 1] || options[0]._id;
      return (
        <Select
          key={parentId}
          value={selected}
          disabled={disabled}
          onChange={handleLevelChange}
          className={selectClassName || 'w-full text-xs p-2 bg-transparent border border-vpa-olive-light text-vpa-olive dark:text-vpa-sand focus:outline-none focus:border-vpa-gold font-mono rounded-lg flex items-center justify-between gap-2 disabled:opacity-60'}
        >
          {options.map(o => (
            <option key={o._id} value={o._id}>{o.name}</option>
          ))}
        </Select>
      );
    })
    .filter(Boolean);

  if (dropdowns.length === 0) {
    // Only a single unit is reachable (e.g. own branch is a leaf) — nothing to pick.
    return (
      <div className="w-full text-xs p-2 bg-transparent border border-vpa-olive-light/50 text-vpa-olive/75 dark:text-vpa-sand/75 font-mono uppercase">
        {byId.get(leafId)?.name || ''}
      </div>
    );
  }

  return <div className="grid grid-cols-1 gap-2">{dropdowns}</div>;
};

export default UnitTreeSelect;
