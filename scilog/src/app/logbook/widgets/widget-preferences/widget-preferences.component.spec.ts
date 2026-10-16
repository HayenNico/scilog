import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { UntypedFormBuilder } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { WidgetPreferencesComponent } from './widget-preferences.component';
import { LogbookInfoService } from '@shared/logbook-info.service';
import { UserPreferencesService } from '@shared/user-preferences.service';
import { WidgetPreferencesDataService, LogbookDataService } from '@shared/remote-data.service';
import { of } from 'rxjs';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { AppConfigService } from 'src/app/app-config.service';

class UserPreferencesMock {
  userInfo = {
    roles: ['roles'],
  };
}

describe('WidgetPreferencesComponent', () => {
  let component: WidgetPreferencesComponent;
  let fixture: ComponentFixture<WidgetPreferencesComponent>;
  let logbookSpy: any;
  let logbookDataSpy: any;
  let widgetPreferencesSpy: any;
  const returnEmpty = () => ({});

  logbookSpy = jasmine.createSpyObj('LogbookInfoService', ['logbookInfo', 'getAvailLogbooks']);
  logbookSpy.logbookInfo.and.returnValue([]);

  logbookDataSpy = jasmine.createSpyObj('LogbookDataService', [
    'getLogbookInfo',
    'getLogbooksInfo',
  ]);
  logbookDataSpy.getLogbooksInfo.and.returnValue([]);

  widgetPreferencesSpy = jasmine.createSpyObj('WidgetPreferencesDataService', [
    'getSnippetsForLogbook',
    'getPlotSnippets',
  ]);
  widgetPreferencesSpy.getSnippetsForLogbook.and.returnValue(of({}));
  widgetPreferencesSpy.getPlotSnippets.and.returnValue(of({}));

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [
        MatDialogModule,
        MatAutocompleteModule,
        CdkTextareaAutosize,
        WidgetPreferencesComponent,
      ],
      providers: [
        UntypedFormBuilder,
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            config: {
              general: {
                type: 'logbook',
                title: 'Logbook view',
              },
              filter: {
                targetId: '12345parentID',
                additionalLogbooks: [],
                tags: [],
              },
              view: {
                order: ['defaultOrder ASC'],
                hideMetadata: false,
                showSnippetHeader: false,
              },
            },
          },
        },
        { provide: LogbookInfoService, useValue: logbookSpy },
        { provide: LogbookDataService, useValue: logbookDataSpy },
        { provide: UserPreferencesService, useClass: UserPreferencesMock },
        {
          provide: WidgetPreferencesDataService,
          useValue: widgetPreferencesSpy,
        },
        {
          provide: AppConfigService,
          useValue: { getConfig: returnEmpty, getScicatSettings: returnEmpty },
        },
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WidgetPreferencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default showImportance to true when not provided in config', () => {
    expect(component.showImportance.value).toBeTrue();
  });

  it('should initialize showImportance from config when provided', () => {
    component.data.view.showImportance = false;
    component.ngOnInit();
    expect(component.showImportance.value).toBeFalse();

    component.data.view.showImportance = true;
    component.ngOnInit();
    expect(component.showImportance.value).toBeTrue();
  });

  it('should save showImportance to data.view on submit', () => {
    const dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);
    component['dialogRef'] = dialogRefSpy;
    component.showImportance.setValue(false);

    component.applyChanges(null);

    expect(component.data.view.showImportance).toBeFalse();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(component.data);
  });

  it('should preserve importance filter independently of showImportance', () => {
    component.importance.setValue([1, 3, 5]);
    component.showImportance.setValue(false);

    component.applyChanges(null);

    expect(component.data.filter.importance).toEqual([1, 3, 5]);
    expect(component.data.view.showImportance).toBeFalse();
  });
});
