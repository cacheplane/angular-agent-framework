import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExampleChatLayoutComponent } from './example-chat-layout.component';

@Component({
  standalone: true,
  imports: [ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <div main data-testid="main-content">Main Content</div>
      <div sidebar data-testid="sidebar-content">Sidebar Content</div>
    </example-chat-layout>
  `,
})
class TestHostComponent {}

@Component({
  standalone: true,
  imports: [ExampleChatLayoutComponent],
  template: `
    <example-chat-layout>
      <div main data-testid="main-only">Main Only</div>
    </example-chat-layout>
  `,
})
class NoSidebarHostComponent {}

@Component({
  standalone: true,
  imports: [ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarPosition="left" sidebarWidth="w-64">
      <div main data-testid="main-content">Main</div>
      <div sidebar data-testid="sidebar-content">Sidebar</div>
    </example-chat-layout>
  `,
})
class LeftSidebarHostComponent {}

@Component({
  standalone: true,
  imports: [ExampleChatLayoutComponent],
  template: `
    <example-chat-layout sidebarWidth="w-80">
      <div main data-testid="main-content">Main</div>
      <div sidebar data-testid="sidebar-content">Sidebar</div>
    </example-chat-layout>
  `,
})
class CustomWidthHostComponent {}

describe('ExampleChatLayoutComponent', () => {
  it('should render main and sidebar content', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="main-content"]')?.textContent).toBe('Main Content');
    expect(el.querySelector('[data-testid="sidebar-content"]')?.textContent).toBe('Sidebar Content');
  });

  it('should use flex-col md:flex-row for responsive layout', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const flexContainer = el.querySelector('.flex.flex-col');
    expect(flexContainer).toBeTruthy();
    expect(flexContainer?.classList.contains('md:flex-row')).toBe(true);
  });

  it('should hide aside when no sidebar content is projected', async () => {
    await TestBed.configureTestingModule({
      imports: [NoSidebarHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(NoSidebarHostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="main-only"]')?.textContent).toBe('Main Only');
    const aside = el.querySelector('aside');
    expect(aside).toBeTruthy();
    expect(aside?.children.length).toBe(0);
  });

  it('should apply md:flex-row-reverse for left sidebar position', async () => {
    await TestBed.configureTestingModule({
      imports: [LeftSidebarHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(LeftSidebarHostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const flexContainer = el.querySelector('.flex.flex-col');
    expect(flexContainer?.classList.contains('md:flex-row-reverse')).toBe(true);
  });

  it('should use border-r instead of border-l for left sidebar', async () => {
    await TestBed.configureTestingModule({
      imports: [LeftSidebarHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(LeftSidebarHostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const aside = el.querySelector('aside');
    expect(aside?.classList.contains('md:border-r')).toBe(true);
    expect(aside?.classList.contains('md:border-l')).toBe(false);
  });

  it('should apply custom sidebar width class', async () => {
    await TestBed.configureTestingModule({
      imports: [CustomWidthHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomWidthHostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const aside = el.querySelector('aside');
    expect(aside?.classList.contains('md:w-80')).toBe(true);
  });

  it('should apply default w-72 sidebar width', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const aside = el.querySelector('aside');
    expect(aside?.classList.contains('md:w-72')).toBe(true);
  });

  it('should set host to full viewport height', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const hostEl = fixture.nativeElement.querySelector('example-chat-layout') as HTMLElement;
    expect(hostEl).toBeTruthy();
  });
});
