import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { HttpModule } from '@angular/http';

// ag-grid
import { AgGridModule } from "@ag-grid-community/angular";

// rxjs
import { RxJsComponentByRow } from "./rxjs-component-example/rxjs-by-row.component";

@NgModule({
    imports: [
        BrowserModule,
        HttpModule,
        AgGridModule.withComponents([])
    ],
    declarations: [
        RxJsComponentByRow
    ],
    bootstrap: [RxJsComponentByRow]
})
export class AppModule {
}
