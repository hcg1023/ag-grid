import { BeanStub } from '../context/beanStub';
import type { AgColumnGroupEvent, Column, ColumnGroup, ColumnGroupShowType, ColumnPinnedType, HeaderColumnId } from '../interfaces/iColumn';
import type { AgColumn } from './agColumn';
import type { AgProvidedColumnGroup } from './agProvidedColumnGroup';
import type { AbstractColDef, ColGroupDef } from './colDef';
export declare function createUniqueColumnGroupId(groupId: string, instanceId: number): HeaderColumnId;
export declare function isColumnGroup(col: Column | ColumnGroup | string): col is AgColumnGroup;
export declare class AgColumnGroup<TValue = any> extends BeanStub<AgColumnGroupEvent> implements ColumnGroup<TValue> {
    readonly isColumn: false;
    private children;
    private displayedChildren;
    private readonly groupId;
    private readonly partId;
    private readonly providedColumnGroup;
    private readonly pinned;
    private left;
    private oldLeft;
    private parent;
    constructor(providedColumnGroup: AgProvidedColumnGroup, groupId: string, partId: number, pinned: ColumnPinnedType);
    reset(): void;
    getParent(): AgColumnGroup | null;
    setParent(parent: AgColumnGroup | null): void;
    getUniqueId(): HeaderColumnId;
    isEmptyGroup(): boolean;
    isMoving(): boolean;
    checkLeft(): void;
    getLeft(): number | null;
    getOldLeft(): number | null;
    setLeft(left: number | null): void;
    getPinned(): ColumnPinnedType;
    getGroupId(): string;
    getPartId(): number;
    getActualWidth(): number;
    isResizable(): boolean;
    getMinWidth(): number;
    addChild(child: AgColumn | AgColumnGroup): void;
    getDisplayedChildren(): (AgColumn | AgColumnGroup)[] | null;
    getLeafColumns(): AgColumn[];
    getDisplayedLeafColumns(): AgColumn[];
    getDefinition(): AbstractColDef | null;
    getColGroupDef(): ColGroupDef | null;
    isPadding(): boolean;
    isExpandable(): boolean;
    isExpanded(): boolean;
    setExpanded(expanded: boolean): void;
    private addDisplayedLeafColumns;
    private addLeafColumns;
    getChildren(): (AgColumn | AgColumnGroup)[] | null;
    getColumnGroupShow(): ColumnGroupShowType | undefined;
    getProvidedColumnGroup(): AgProvidedColumnGroup;
    getPaddingLevel(): number;
    calculateDisplayedColumns(): void;
}
