import '@testing-library/jest-dom/vitest'

// Mocking Radix Elements (I LOVE TESTING!!!!!!!)
window.HTMLElement.prototype.scrollIntoView = vi.fn() // https://stackoverflow.com/questions/53271193/typeerror-scrollintoview-is-not-a-function
window.HTMLElement.prototype.hasPointerCapture = vi.fn() // https://github.com/testing-library/user-event/discussions/1087

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

document.elementFromPoint = vi.fn()

// jsdom does not implement matchMedia, used by useIsMobile and vaul.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
