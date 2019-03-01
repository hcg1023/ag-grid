import {Autowired, Context, PostConstruct} from "../context/context";
import { IMenuFactory } from "../interfaces/iMenuFactory";
import { Column } from "../entities/column";
import { SetLeftFeature } from "../rendering/features/setLeftFeature";
import {
    IFloatingFilterParams,
    IFloatingFilterComp,
    FloatingFilterChange,
    ReadModelAsStringFloatingFilterComp
} from "./floatingFilter";
import { Component } from "../widgets/component";
import { RefSelector } from "../widgets/componentAnnotations";
import { IComponent } from "../interfaces/iComponent";
import { GridOptionsWrapper } from "../gridOptionsWrapper";
import { Beans } from "../rendering/beans";
import { HoverFeature } from "../headerRendering/hoverFeature";
import { Events } from "../events";
import { EventService } from "../eventService";
import { ColumnHoverService } from "../rendering/columnHoverService";
import { CombinedFilter } from "./baseFilter";
import { _, Promise } from "../utils";
import {ColDef} from "../entities/colDef";
import {IFilterComp} from "../interfaces/iFilter";
import {ComponentRecipes, ComponentToUse} from "../components/framework/componentRecipes";
import {ComponentResolver} from "../components/framework/componentResolver";
import {GridApi} from "../gridApi";
import {ColumnApi} from "../columnController/columnApi";
import {FilterManager} from "./filterManager";

export class FloatingFilterWrapper extends Component {

    private static TEMPLATE =
        `<div class="ag-header-cell" aria-hidden="true">
            <div ref="eFloatingFilterBody" aria-hidden="true"></div>
            <div class="ag-floating-filter-button" ref="eButtonWrapper" aria-hidden="true">
                    <button type="button" (click)="showParentFilter" ref="eButtonShowMainFilter"></button>
            </div>
        </div>`;

    @Autowired('context') private context: Context;
    @Autowired('columnHoverService') private columnHoverService: ColumnHoverService;
    @Autowired('eventService') private eventService: EventService;
    @Autowired('beans') private beans: Beans;
    @Autowired('gridOptionsWrapper') private gridOptionsWrapper: GridOptionsWrapper;
    @Autowired("componentResolver") private componentResolver: ComponentResolver;
    @Autowired("gridApi") private gridApi: GridApi;
    @Autowired("columnApi") private columnApi: ColumnApi;
    @Autowired("filterManager") private filterManager: FilterManager;
    @Autowired('menuFactory') private menuFactory: IMenuFactory;

    @RefSelector('eFloatingFilterBody') private eFloatingFilterBody: HTMLElement;
    @RefSelector('eButtonWrapper') private eButtonWrapper: HTMLElement;
    @RefSelector('eButtonShowMainFilter') private eButtonShowMainFilter: HTMLElement;

    private readonly column: Column;

    private suppressFilterButton: boolean;

    private floatingFilterCompPromise: Promise<IFloatingFilterComp<any, any, any>>;

    constructor(column: Column) {
        super(FloatingFilterWrapper.TEMPLATE);
        this.column = column;
    }

    @PostConstruct
    private postConstruct(): void {
        this.instantiate(this.context);

        this.setupFloatingFilter();
        this.setupWidth();
        this.setupLeftPositioning();
        this.setupColumnHover();
        this.addFeature(this.context, new HoverFeature([this.column], this.getGui()));
    }

    private setupFloatingFilter(): void {
        const colDef = this.column.getColDef();
        if (colDef.filter) {
            this.floatingFilterCompPromise = this.getFloatingFilterInstance();
            this.floatingFilterCompPromise.then( compInstance => {
                if (compInstance) {
                    this.setupWithFloatingFilter(compInstance);
                } else {
                    this.setupEmpty();
                }
            });
            this.setupSyncWithFilter();
        } else {
            this.setupEmpty();
        }
    }

    private setupLeftPositioning(): void {
        const setLeftFeature = new SetLeftFeature(this.column, this.getGui(), this.beans);
        setLeftFeature.init();
        this.addDestroyFunc(setLeftFeature.destroy.bind(setLeftFeature));
    }

    private setupSyncWithFilter(): void {
        const syncWithFilter = () => {
            const filterComponentPromise: Promise<IFilterComp> = this.filterManager.getFilterComponent(this.column, 'NO_UI');
            this.onParentModelChanged(filterComponentPromise.resolveNow(null, filter => filter.getModel()));
        };

        this.addDestroyableEventListener(this.column, Column.EVENT_FILTER_CHANGED, syncWithFilter);

        const cachedFilter = this.filterManager.cachedFilter(this.column);
        if (cachedFilter) {
            syncWithFilter();
        }
    }

    // linked to event listener in template
    private showParentFilter() {
        this.menuFactory.showMenuAfterButtonClick(this.column, this.eButtonShowMainFilter, 'filterMenuTab', ['filterMenuTab']);
    }

    private setupColumnHover(): void {
        this.addDestroyableEventListener(this.eventService, Events.EVENT_COLUMN_HOVER_CHANGED, this.onColumnHover.bind(this));
        this.onColumnHover();
    }

    private onColumnHover(): void {
        const isHovered = this.columnHoverService.isHovered(this.column);
        _.addOrRemoveCssClass(this.getGui(), 'ag-column-hover', isHovered);
    }

    private setupWidth(): void {
        this.addDestroyableEventListener(this.column, Column.EVENT_WIDTH_CHANGED, this.onColumnWidthChanged.bind(this));
        this.onColumnWidthChanged();
    }

    private onColumnWidthChanged(): void {
        this.getGui().style.width = this.column.getActualWidth() + 'px';
    }

    private setupWithFloatingFilter(floatingFilterComp: IFloatingFilterComp<any,any,any>): void {

        const disposeFunc = () => {
            if (floatingFilterComp.destroy) {
                floatingFilterComp.destroy();
            }
        };

        if (!this.isAlive()) {
            disposeFunc();
            return;
        }

        this.addDestroyFunc(disposeFunc);

        const floatingFilterCompUi = floatingFilterComp.getGui();

        _.addOrRemoveCssClass(this.eFloatingFilterBody, 'ag-floating-filter-body', !this.suppressFilterButton);
        _.addOrRemoveCssClass(this.eFloatingFilterBody, 'ag-floating-filter-full-body', this.suppressFilterButton);

        _.setVisible(this.eButtonWrapper, !this.suppressFilterButton);

        const eIcon = _.createIconNoSpan('filter', this.gridOptionsWrapper, this.column);
        this.eButtonShowMainFilter.appendChild(eIcon);

        this.eFloatingFilterBody.appendChild(floatingFilterCompUi);

        if (floatingFilterComp.afterGuiAttached) {
            floatingFilterComp.afterGuiAttached();
        }

        this.wireQuerySelectors();
    }

    private getFloatingFilterInstance(): Promise<IFloatingFilterComp<any, any, any>> {
        const colDef = this.column.getColDef();
        let defaultFloatingFilterType: string;

        if (typeof colDef.filter === 'string') {
            // will be undefined if not in the map
            defaultFloatingFilterType = ComponentRecipes.filterToFloatingFilterNames[colDef.filter];
        } else if (colDef.filter===true) {
            defaultFloatingFilterType = this.gridOptionsWrapper.isEnterprise() ? 'agSetColumnFloatingFilter' : 'agTextColumnFloatingFilter';
        }

        const params = this.createFloatingFilterParams();
        const dynamicParams = this.createDynamicParams();

        // this is unusual - we need a value from the merged params OUTSIDE the component the params are for. the params
        // are for the floating filter component, but this property is actually for the wrapper.
        const mergedParams = this.componentResolver.mergeParams(colDef, 'floatingFilterComponent', dynamicParams, params);
        this.suppressFilterButton = mergedParams.suppressFilterButton; // used later in setupWithFilter()

        let promise: Promise<IFloatingFilterComp<any, any, any>> = this.componentResolver.createAgGridComponent<IFloatingFilterComp<any, any, any>>(
            colDef,
            params,
            "floatingFilterComponent",
            dynamicParams,
            defaultFloatingFilterType,
            false
        );

        if (!promise) {
            const filterComponent = this.getFilterComponentPrototype(colDef);
            const getModelAsStringExists = filterComponent && filterComponent.prototype && filterComponent.prototype.getModelAsString;

            if (getModelAsStringExists) {
                const rawModelFn = params.currentParentModel;
                params.currentParentModel = () => {
                    const parentPromise:Promise<IFilterComp> = this.filterManager.getFilterComponent(this.column, 'NO_UI');
                    return parentPromise.resolveNow(null, parent => parent.getModelAsString ? parent.getModelAsString(rawModelFn()) : null) as any;
                };
                const compInstance = this.componentResolver.createInternalAgGridComponent<any, IFloatingFilterComp<any, any, any>>(
                    ReadModelAsStringFloatingFilterComp,
                    params
                );
                promise = Promise.resolve(compInstance);
            }
        }

        return promise;
    }

    private createDynamicParams(): any {
        return {
            column: this.column,
            colDef: this.column.getColDef(),
            api: this.gridApi,
            columnApi: this.columnApi
        };
    }

    private getFilterComponentPrototype(colDef: ColDef): {new(): any} {
        const resolvedComponent = this.componentResolver.getComponentToUse(colDef, "filter", this.createDynamicParams());
        return resolvedComponent ? resolvedComponent.component : null;
    }

    private setupEmpty(): void {
        _.setVisible(this.eButtonWrapper, false);
    }

    private createFloatingFilterParams(): IFloatingFilterParams<any, any> {
        return {
            api: this.gridApi,
            column: this.column,
            currentParentModel: this.currentParentModel.bind(this),
            onFloatingFilterChanged: this.onFloatingFilterChanged.bind(this),
            suppressFilterButton: false // This one might be overridden from the colDef
        };
    }

    private currentParentModel(): any {
        const filterComponentPromise: Promise<IFilterComp> = this.filterManager.getFilterComponent(this.column, 'NO_UI') as any;
        const wholeParentFilter: CombinedFilter<any> | any = filterComponentPromise.resolveNow(null, (filter: any) =>
            (filter.getNullableModel) ?
                filter.getNullableModel() :
                filter.getModel()
        );
        return (wholeParentFilter && (wholeParentFilter as CombinedFilter<any>).operator != null) ?
            (wholeParentFilter as CombinedFilter<any>).condition1
            : wholeParentFilter as any;
    }

    private onFloatingFilterChanged(change: any): boolean {
        let captureModelChangedResolveFunc: (modelChanged: boolean) => void;
        const modelChanged: Promise<boolean> = new Promise((resolve) => {
            captureModelChangedResolveFunc = resolve;
        });
        const filterComponentPromise: Promise<IFilterComp> = this.filterManager.getFilterComponent(this.column, 'NO_UI') as any;
        filterComponentPromise.then(filterComponent => {
            if (filterComponent.onFloatingFilterChanged) {
                //If going through this branch of code the user MUST
                //be passing an object of type change that contains
                //a model property inside and some other stuff
                const result: boolean = filterComponent.onFloatingFilterChanged(change as any);
                captureModelChangedResolveFunc(result);
            } else {
                //If going through this branch of code the user MUST
                //be passing the plain model and delegating to ag-Grid
                //the responsibility to set the parent model and refresh
                //the filters
                filterComponent.setModel(change as any);
                this.filterManager.onFilterChanged();
                captureModelChangedResolveFunc(true);
            }
        });
        return modelChanged.resolveNow(true, changed => changed);
    }

    private onParentModelChanged(parentModel: any | CombinedFilter<any>): void {
        let combinedFilter: CombinedFilter<any>;
        let mainModel: any = null;
        if (parentModel && (parentModel as CombinedFilter<any>).operator) {
            combinedFilter = (parentModel as CombinedFilter<any>);
            mainModel = combinedFilter.condition1;
        } else {
            mainModel = parentModel;
        }

        this.floatingFilterCompPromise.then(floatingFilterComp => {
            floatingFilterComp.onParentModelChanged(mainModel, combinedFilter);
        });
    }
}