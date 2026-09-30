import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  HostListener,
  OnDestroy,
  NgZone,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { MatDialogConfig, MatDialog } from '@angular/material/dialog';
import { WidgetPreferencesComponent } from '../../widgets/widget-preferences/widget-preferences.component';
import { LogbookItemComponent } from '../../widgets/logbook-item/logbook-item.component';
import { ActivatedRoute } from '@angular/router';
import { ViewsService } from '@shared/views.service';
import { Subscription } from 'rxjs';
import { ExportDialogComponent } from './export-dialog/export-dialog.component';
import { WidgetItemConfig } from '@model/config';
import { ComponentCanDeactivate } from '../../core/navigation-guard-service';
import { NgStyle, NgIf, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { MatIconButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { ChatComponent } from '../../widgets/chat/chat.component';
import { ChartComponent } from '../../widgets/chart/chart.component';
import { TodosComponent } from '../../widgets/todos/todos.component';
import { SnippetViewerComponent } from '../../widgets/snippet-viewer/snippet-viewer.component';
import { ScicatViewerComponent } from '../../widgets/scicat-viewer/scicat-viewer.component';
import { AsyncPipe } from '@angular/common';
import { DocumentOutlineComponent } from '../../core/document-outline/document-outline.component';
import { NavigationToggleService } from '../../core/navigation-toggle.service';

@Component({
  selector: 'app-dashboard-item',
  templateUrl: './dashboard-item.component.html',
  styleUrls: ['./dashboard-item.component.scss'],
  imports: [
    NgStyle,
    NgIf,
    MatIconButton,
    MatTooltip,
    MatIcon,
    NgSwitch,
    NgSwitchCase,
    LogbookItemComponent,
    ChatComponent,
    ChartComponent,
    TodosComponent,
    SnippetViewerComponent,
    ScicatViewerComponent,
    NgSwitchDefault,
    AsyncPipe,
    DocumentOutlineComponent,
  ],
})
export class DashboardItemComponent implements OnInit, ComponentCanDeactivate, OnDestroy {
  @Input()
  configIndex: number;

  config: WidgetItemConfig;

  @Output() openFullscreen = new EventEmitter<any>();

  @Output() openWidgetPreferences = new EventEmitter<any>();

  @ViewChild(LogbookItemComponent) logbookChild: LogbookItemComponent;
  @ViewChild(TodosComponent) todosChild!: TodosComponent;

  subscriptions: any[] = [];
  dashboardView = true;
  viewSubscription: Subscription = null;

  logbookId: string;

  navWidth = 280;
  isResizingNav = false;
  private resizeStartX = 0;
  private resizeStartWidth = 280;
  private minNavWidth = 200;
  private navStorageKey = 'scilog_nav_pane_width';
  private onMouseMoveBound: ((e: MouseEvent) => void) | null = null;
  private onMouseUpBound: ((e: MouseEvent) => void) | null = null;
  private onTouchMoveBound: ((e: TouchEvent) => void) | null = null;
  private onTouchEndBound: ((e: TouchEvent) => void) | null = null;

  constructor(
    private dialog: MatDialog,
    private route: ActivatedRoute,
    private views: ViewsService,
    public navToggle: NavigationToggleService,
    private zone: NgZone,
    private elementRef: ElementRef,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    try {
      const savedWidth = localStorage.getItem(this.navStorageKey);
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= this.minNavWidth) {
          this.navWidth = parsed;
        }
      }
    } catch (e) {
      // Ignore if localStorage is restricted
    }
    if (this.route.parent != null) {
      this.subscriptions.push(
        this.route.parent.url.subscribe((urlPath) => {
          if (typeof urlPath[1] != 'undefined') {
            this.logbookId = urlPath[1].path;
          }
        }),
      );
    }
    this.subscriptions.push(
      this.route.queryParamMap.subscribe((data) => {
        console.log('query params: ', data);
        if (data['params'].id) {
          this.configIndex = data['params'].id;
          this.dashboardView = false;
        }
        if (this.viewSubscription != null) {
          this.viewSubscription.unsubscribe();
        }
        this.viewSubscription = this.views.currentWidgetConfigs.subscribe((config) => {
          console.log(config);
          if (config != null && config.length > 0 && this.configIndex < config.length) {
            if (typeof this.configIndex !== 'undefined') {
              console.log(config);
              console.log(this.configIndex);
              this.config = config[this.configIndex].config;
            } else {
              this.configIndex = this.route.snapshot.queryParams.id;
              this.config = config[this.configIndex].config;
            }
          }
        });
      }),
    );
    console.log('configIndex', this.configIndex);
  }

  requestFullscreen() {
    this.openFullscreen.emit(this.configIndex);
  }

  exportLogbook() {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.autoFocus = true;
    dialogConfig.disableClose = true;
    dialogConfig.data = this.config;
    this.dialog.open(ExportDialogComponent, dialogConfig);
  }

  exportTasksFromHeader() {
    this.todosChild?.exportTasksToLogbook();
  }
  async openPreferences() {
    const dialogConfig = new MatDialogConfig();
    dialogConfig.autoFocus = false;
    dialogConfig.disableClose = true;
    dialogConfig.data = { config: this.config };
    const dialogRef = this.dialog.open(WidgetPreferencesComponent, dialogConfig);
    let data = await dialogRef.afterClosed().toPromise();
    if (data) {
      console.log('Dialog output:', data);
      this.views.updateWidgetConfig(data, this.configIndex);
      this.config = data;
      switch (this.config.general.type) {
        case 'logbook':
          this.logbookChild.ngOnInit();
          break;
        default:
          break;
      }
    }
  }
  startNavResize(event: MouseEvent | TouchEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isResizingNav = true;
    this.resizeStartX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
    this.resizeStartWidth = this.navWidth;

    this.zone.runOutsideAngular(() => {
      this.onMouseMoveBound = (e: MouseEvent) => this.onNavResizeMove(e.clientX);
      this.onMouseUpBound = () => this.stopNavResize();
      this.onTouchMoveBound = (e: TouchEvent) => {
        if (e.touches && e.touches.length > 0) {
          this.onNavResizeMove(e.touches[0].clientX);
        }
      };
      this.onTouchEndBound = () => this.stopNavResize();

      window.addEventListener('mousemove', this.onMouseMoveBound);
      window.addEventListener('mouseup', this.onMouseUpBound);
      window.addEventListener('touchmove', this.onTouchMoveBound, { passive: false });
      window.addEventListener('touchend', this.onTouchEndBound);
      window.addEventListener('touchcancel', this.onTouchEndBound);
    });
  }

  private onNavResizeMove(clientX: number) {
    if (!this.isResizingNav) return;
    const deltaX = clientX - this.resizeStartX;
    // Navigation is on the right side of the flex layout:
    // Dragging left (negative deltaX) increases navigation width
    // Dragging right (positive deltaX) decreases navigation width
    let newWidth = this.resizeStartWidth - deltaX;

    const hostElem = this.elementRef.nativeElement as HTMLElement;
    const containerWidth = hostElem ? hostElem.offsetWidth : window.innerWidth;
    // Ensure navigation width doesn't make logbook too narrow (reserve at least 320px for logbook)
    const maxAllowedWidth = Math.max(this.minNavWidth, containerWidth - 320);
    const maxNavWidth = Math.min(700, maxAllowedWidth);

    if (newWidth < this.minNavWidth) {
      newWidth = this.minNavWidth;
    } else if (newWidth > maxNavWidth) {
      newWidth = maxNavWidth;
    }

    this.navWidth = Math.round(newWidth);
    this.cdr.detectChanges();
  }

  private stopNavResize() {
    if (!this.isResizingNav) return;
    this.isResizingNav = false;
    this.removeResizeListeners();
    try {
      localStorage.setItem(this.navStorageKey, this.navWidth.toString());
    } catch (e) {
      // localStorage might be unavailable or restricted
    }
    this.cdr.detectChanges();
  }

  private removeResizeListeners() {
    if (this.onMouseMoveBound) {
      window.removeEventListener('mousemove', this.onMouseMoveBound);
      this.onMouseMoveBound = null;
    }
    if (this.onMouseUpBound) {
      window.removeEventListener('mouseup', this.onMouseUpBound);
      this.onMouseUpBound = null;
    }
    if (this.onTouchMoveBound) {
      window.removeEventListener('touchmove', this.onTouchMoveBound);
      this.onTouchMoveBound = null;
    }
    if (this.onTouchEndBound) {
      window.removeEventListener('touchend', this.onTouchEndBound);
      window.removeEventListener('touchcancel', this.onTouchEndBound);
      this.onTouchEndBound = null;
    }
  }

  ngOnDestroy(): void {
    this.removeResizeListeners();
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }

  @HostListener('window:beforeunload')
  canDeactivate(): boolean {
    if (false) return true;
    return false;
  }
}
