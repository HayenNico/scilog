import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { Subscription } from 'rxjs';
import { LogbookItemDataService } from '@shared/remote-data.service';
import { ChangeStreamService } from '@shared/change-stream.service';
import { ScrollToElementService } from '../scroll-to-element.service';
import { ViewsService } from '@shared/views.service';
import { WidgetItemConfig } from '@model/config';
import { NgIf, NgFor, NgStyle } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { Paragraphs } from '@model/paragraphs';

export interface HeadingItem {
  id: string;
  snippetId: string;
  title: string;
  level: number;
}

@Component({
  selector: 'app-document-outline',
  templateUrl: './document-outline.component.html',
  styleUrls: ['./document-outline.component.scss'],
  providers: [ChangeStreamService],
  imports: [NgIf, NgFor, NgStyle, MatIconModule, MatTooltipModule, MatButtonModule],
  standalone: true,
})
export class DocumentOutlineComponent implements OnInit, OnDestroy {
  @Input() logbookId: string;

  headings: HeadingItem[] = [];
  allSnippets: Paragraphs[] = [];
  isLoading = false;
  activeHeadingId: string = null;

  private subscriptions: Subscription[] = [];
  private currentConfig: WidgetItemConfig;
  private scrollListener: any;
  private isAutoScrolling = false;

  constructor(
    private logbookItemDataService: LogbookItemDataService,
    private changeStreamService: ChangeStreamService,
    private scrollToElementService: ScrollToElementService,
    private viewsService: ViewsService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
  ) {}

  ngOnInit() {
    this.subscriptions.push(
      this.viewsService.currentWidgetConfigs.subscribe((configs) => {
        if (configs) {
          const logbookConfig = configs.find((c) => c.config.general.type === 'logbook');
          if (logbookConfig) {
            this.currentConfig = logbookConfig.config;
            this.loadHeadings();
            this.setupChangeStream();
          }
        }
      }),
    );

    this.zone.runOutsideAngular(() => {
      this.scrollListener = () => this.onScroll();

      const checkAndAttach = () => {
        const container = document.querySelector('.logbook-content');
        if (container) {
          container.addEventListener('scroll', this.scrollListener, { passive: true });
        } else {
          setTimeout(checkAndAttach, 500);
        }
      };
      checkAndAttach();
    });
  }

  private setupChangeStream() {
    if (this.logbookId && this.currentConfig) {
      this.subscriptions.push(
        this.changeStreamService
          .getNotification(this.logbookId, this.currentConfig)
          .subscribe((notification) => {
            if (notification?.content?.snippetType === 'paragraph') {
              this.loadHeadings();
            }
          }),
      );
    }
  }

  async loadHeadings() {
    if (!this.currentConfig || !this.logbookId) return;
    this.isLoading = true;
    try {
      this.allSnippets = await this.logbookItemDataService.getDataBuffer(
        0,
        10000,
        this.currentConfig,
      );
      this.parseHeadings(this.allSnippets);
    } catch (e) {
      console.error('Error loading headings', e);
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private parseHeadings(snippets: Paragraphs[]) {
    this.headings = [];
    const parser = new DOMParser();
    snippets.forEach((snippet) => {
      if (!snippet.textcontent) return;
      const doc = parser.parseFromString(snippet.textcontent, 'text/html');
      const headingElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headingElements.forEach((el, index) => {
        const level = parseInt(el.tagName.substring(1), 10);
        this.headings.push({
          id: el.id || `heading-${snippet.id}-${index}`,
          snippetId: snippet.id,
          title: el.textContent || 'Untitled',
          level: level,
        });
      });
    });

    // Initial check
    setTimeout(() => this.onScroll(), 100);
  }

  scrollToHeading(heading: HeadingItem) {
    if (this.currentConfig) {
      this.isAutoScrolling = true;
      this.activeHeadingId = heading.id;
      this.cdr.detectChanges();

      this.scrollToElementService.selectedItem = {
        config: this.currentConfig,
        event: { id: heading.snippetId },
      };

      setTimeout(() => {
        this.isAutoScrolling = false;
      }, 1000);
    }
  }

  private onScroll() {
    if (this.isAutoScrolling || this.headings.length === 0) return;

    const container = document.querySelector('.logbook-content');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const snippets = Array.from(container.querySelectorAll('app-snippet'));

    let foundHeadingId = null;
    let closestDistance = -Infinity;

    for (const snippet of snippets) {
      const snippetId = snippet.getAttribute('data-snippet-id');
      if (!snippetId) continue;

      const headingElements = snippet.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headingElements.forEach((h, index) => {
        const hRect = h.getBoundingClientRect();
        const distance = hRect.top - containerRect.top;

        // threshold 120px to consider it "active"
        if (distance <= 120 && distance > closestDistance) {
          closestDistance = distance;
          foundHeadingId = h.id || `heading-${snippetId}-${index}`;
        }
      });
    }

    // If no heading is found in DOM, fallback to virtual scrolling chronological order
    if (!foundHeadingId && snippets.length > 0) {
      const firstSnippetId = snippets[0].getAttribute('data-snippet-id');
      const precedingHeading = this.findPrecedingHeading(firstSnippetId);
      if (precedingHeading) {
        foundHeadingId = precedingHeading.id;
      }
    }

    if (foundHeadingId && foundHeadingId !== this.activeHeadingId) {
      this.zone.run(() => {
        this.activeHeadingId = foundHeadingId;
        this.cdr.detectChanges();
      });
    }
  }

  private findPrecedingHeading(snippetId: string): HeadingItem {
    const snippetIndex = this.allSnippets.findIndex((s) => s.id === snippetId);
    if (snippetIndex === -1) return null;

    for (let i = snippetIndex; i >= 0; i--) {
      const sId = this.allSnippets[i].id;
      const headingsInSnippet = this.headings.filter((h) => h.snippetId === sId);
      if (headingsInSnippet.length > 0) {
        return headingsInSnippet[headingsInSnippet.length - 1];
      }
    }
    return this.headings.length > 0 ? this.headings[0] : null;
  }

  ngOnDestroy() {
    this.subscriptions.forEach((s) => s.unsubscribe());
    const container = document.querySelector('.logbook-content');
    if (container && this.scrollListener) {
      container.removeEventListener('scroll', this.scrollListener);
    }
  }
}
