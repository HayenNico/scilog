import { Component, HostListener, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ChangeStreamService } from '@shared/change-stream.service';
import { ChangeStreamNotification } from '@shared/changestreamnotification.model';
import { Subscription } from 'rxjs';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { LogbookInfoService } from '@shared/logbook-info.service';
import { Logbooks } from '@model/logbooks';
import { WidgetConfig } from '@model/config';
import { TasksService } from '@shared/tasks.service';
import { ViewsService } from '@shared/views.service';
import { TagService } from '@shared/tag.service';
import { ToolbarComponent } from '../core/toolbar/toolbar.component';
import { ResizedDirective } from '../core/directives/resized.directive';
import {
  MatSidenavContainer,
  MatSidenav,
  MatSidenavContent,
  MatDrawerMode,
} from '@angular/material/sidenav';
import { MatFabButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { NavigationButtonComponent } from './navigation-button/navigation-button.component';
import { NgStyle } from '@angular/common';
import { LogbookDataService } from '@shared/remote-data.service';

import { DocumentOutlineComponent } from './core/document-outline/document-outline.component';

import { filter } from 'rxjs/operators';
import { NavigationEnd } from '@angular/router';

import { NavigationToggleService } from './core/navigation-toggle.service';

@Component({
  selector: 'app-logbook',
  templateUrl: './logbook.component.html',
  styleUrls: ['./logbook.component.scss'],
  providers: [ChangeStreamService],
  imports: [
    ToolbarComponent,
    ResizedDirective,
    MatSidenavContainer,
    MatSidenav,
    MatFabButton,
    MatTooltip,
    RouterLink,
    MatIcon,
    MatDivider,
    NavigationButtonComponent,
    MatSidenavContent,
    NgStyle,
    RouterOutlet,
  ],
  standalone: true,
})
export class LogbookComponent implements OnInit, OnDestroy {
  logbookId: string;
  isLogbookActive = false;
  isNavigationOpen = false;

  showLoadingCircle = true;
  array: ChangeStreamNotification[];

  numTasks = 0;

  sidenavOpened = true;
  sidenavOver: MatDrawerMode = 'push';
  expandHeight = '42px';
  collapseHeight = '42px';
  displayMode = 'flat';
  mobile = false;
  viewOption = 'table';
  logbook: Logbooks;
  widgetConfigs: WidgetConfig[];
  dashboardView = true;

  logbookContainer: number[] = [];
  tasksContainer: number[] = [];
  chatContainer: number[] = [];
  plotContainer: number[] = [];
  snippetViewerContainer: number[] = [];

  subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private logbookInfo: LogbookInfoService,
    private logbookDataService: LogbookDataService,
    private tasks: TasksService,
    private views: ViewsService,
    private router: Router,
    private tags: TagService,
    public navToggle: NavigationToggleService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.subscriptions.push(
      this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
        this.checkActiveTab();
      }),
    );

    this.subscriptions.push(
      this.tasks.currentTasks.subscribe((tasks) => {
        this.numTasks = this.tasks.numTasks;
      }),
    );

    this.subscriptions.push(
      this.views.currentWidgetConfigs.subscribe((view) => {
        if (view != null && view.length > 0) {
          console.log(view);
          this.widgetConfigs = view;
          this.logbookContainer = [];
          this.chatContainer = [];
          this.tasksContainer = [];
          this.plotContainer = [];
          this.snippetViewerContainer = [];
          view.forEach((view, index) => {
            switch (view.config.general.type) {
              case 'logbook':
                this.logbookContainer.push(index);
                break;
              case 'chat':
                this.chatContainer.push(index);
                break;
              case 'graph':
                this.plotContainer.push(index);
                break;
              case 'tasks':
                this.tasksContainer.push(index);
                break;
              case 'snippetViewer':
                this.snippetViewerContainer.push(index);
                break;
              default:
                break;
            }
          });
          this.checkActiveTab();
        }
      }),
    );

    this.subscriptions.push(
      this.route.paramMap.subscribe((params) => {
        this.logbookId = params.get('logbookId');
        console.log('logbook: ', this.logbookId);
        this.updateLogbookInfo();
        this.logbookDataService.touchLogbook(this.logbookId).catch(() => {
          console.error('Error touching logbook');
        });
      }),
    );
  }

  async updateLogbookInfo() {
    if (this.logbookInfo.logbookInfo == null) {
      await this.logbookInfo.getLogbookInfo(this.logbookId);
    }
    await this.tags.updateTags();
    console.log(this.tags.getTags());
  }

  openMenu() {
    this.sidenavOpened = !this.sidenavOpened;
  }

  deactivateLogbook() {
    this.logbookInfo.logbookInfo = null;
  }

  checkActiveTab() {
    const urlTree = this.router.parseUrl(this.router.url);
    const id = urlTree.queryParams['id'];

    if (id !== undefined && this.router.url.includes('dashboard-item')) {
      this.isLogbookActive = this.logbookContainer.includes(Number(id));
    } else if (
      this.router.url.includes('dashboard') &&
      !this.router.url.includes('dashboard-item')
    ) {
      this.isLogbookActive = this.logbookContainer.length > 0;
    } else {
      this.isLogbookActive = false;
      this.navToggle.set(false);
    }
  }

  openDashboardItem(id: number) {}

  initialNavigation() {
    if (this.mobile && this.logbookId) {
      console.log(['logbooks/' + this.logbookId + '/dashboard-item']);
      this.router.navigate(['logbooks/' + this.logbookId + '/dashboard-item'], {
        queryParams: { id: 0 },
      });
    }
  }

  @HostListener('window:resize')
  onResized() {
    this.setMobileDependentOptions();
  }

  private setMobileDependentOptions() {
    this.mobile = window.innerWidth < 959;
    if (this.mobile) {
      this.sidenavOpened = false;
      this.sidenavOver = 'over';
      if (this.route.snapshot.queryParams.id) {
        this.dashboardView = false;
      }
    } else {
      this.sidenavOpened = true;
      this.sidenavOver = 'side';
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
  }
}
