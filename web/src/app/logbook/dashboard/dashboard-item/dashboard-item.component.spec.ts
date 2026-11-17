import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { DashboardItemComponent } from './dashboard-item.component';
import { ViewsService } from '@shared/views.service';
import { ViewsServiceMock } from '../../../logbook/widgets/logbook-item/logbook-item.component.spec';

describe('DashboardItemComponent', () => {
  let component: DashboardItemComponent;
  let fixture: ComponentFixture<DashboardItemComponent>;
  let viewsSpy: any;
  viewsSpy = jasmine.createSpyObj('ViewsService', ['getLogbookViews']);

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: ViewsService, useClass: ViewsServiceMock }],
      imports: [MatDialogModule, RouterTestingModule, DashboardItemComponent],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DashboardItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize default navigation width to 280 or load from localStorage', () => {
    expect(component.navWidth).toBeGreaterThanOrEqual(200);
  });

  it('should resize navigation pane within min and max constraints', () => {
    const mouseEvent = new MouseEvent('mousedown', { clientX: 500 });
    component.startNavResize(mouseEvent);
    expect(component.isResizingNav).toBeTrue();

    // Dragging left increases width (since nav pane is on the right)
    // clientX = 400 => deltaX = -100 => navWidth increases by 100
    component['onNavResizeMove'](400);
    expect(component.navWidth).toBe(380);

    // Dragging right decreases width
    component['onNavResizeMove'](650); // deltaX = 150 => 280 - 150 = 130, but min is 200
    expect(component.navWidth).toBe(200);

    component['stopNavResize']();
    expect(component.isResizingNav).toBeFalse();
  });

  it('should persist navigation width to localStorage on resize end', () => {
    spyOn(localStorage, 'setItem');
    component.navWidth = 350;
    component.isResizingNav = true;
    component['stopNavResize']();

    expect(localStorage.setItem).toHaveBeenCalledWith('scilog_nav_pane_width', '350');
  });
});
